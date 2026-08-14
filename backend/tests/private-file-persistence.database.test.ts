import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";

const suite =
  process.env.PRIVATE_FILE_DATABASE_TESTS === "1" ? describe : describe.skip;

suite("persistência Core de arquivos privados no PostgreSQL", () => {
  const companyAId = randomUUID();
  const companyBId = randomUUID();
  const branchAId = randomUUID();
  const branchBId = randomUUID();
  const userAId = randomUUID();
  const userBId = randomUUID();
  const checkInAId = randomUUID();
  const checkInA2Id = randomUUID();
  const checkInBId = randomUUID();
  const damageAId = randomUUID();

  beforeAll(async () => {
    await createTenantGraph("A", companyAId, branchAId, userAId, [
      checkInAId,
      checkInA2Id,
    ]);
    await createTenantGraph("B", companyBId, branchBId, userBId, [checkInBId]);
    const firstCheckIn = await prisma.vehicleCheckIn.findUniqueOrThrow({
      where: { id: checkInAId },
    });
    await prisma.checkInDamage.create({
      data: {
        id: damageAId,
        companyId: companyAId,
        workOrderId: firstCheckIn.workOrderId,
        checkInId: checkInAId,
        vehicleId: firstCheckIn.vehicleId,
        location: "HOOD",
        damageType: "DENT",
        severity: "MINOR",
        observedByUserId: userAId,
      },
    });
  });

  afterAll(async () => prisma.$disconnect());

  it("permite vínculo geral válido na mesma empresa e soft delete", async () => {
    const asset = await createAsset(companyAId, userAId, "CHECK_IN");
    const attachment = await prisma.checkInEvidenceAttachment.create({
      data: {
        companyId: companyAId,
        checkInId: checkInAId,
        fileAssetId: asset.id,
        category: "FRONT",
        sequence: 1,
        createdByUserId: userAId,
      },
    });
    const deletedAt = new Date();
    await prisma.$transaction([
      prisma.checkInEvidenceAttachment.update({
        where: { id: attachment.id },
        data: { deletedAt },
      }),
      prisma.fileAsset.update({
        where: { id: asset.id },
        data: { status: "DELETED", deletedAt },
      }),
    ]);
    expect(
      await prisma.fileAsset.findUnique({ where: { id: asset.id } }),
    ).toMatchObject({ status: "DELETED", deletedAt });
    await expect(
      prisma.checkInEvidenceAttachment.create({
        data: {
          companyId: companyAId,
          checkInId: checkInA2Id,
          fileAssetId: asset.id,
          category: "REAR",
          sequence: 1,
          createdByUserId: userAId,
        },
      }),
    ).rejects.toBeDefined();
  });

  it("rejeita storageKey duplicada e vínculo cross-tenant", async () => {
    const storageKey = `objects/${randomUUID()}.jpg`;
    await createAsset(companyAId, userAId, "CHECK_IN", { storageKey });
    await expect(
      createAsset(companyAId, userAId, "CHECK_IN", { storageKey }),
    ).rejects.toBeDefined();

    const assetA = await createAsset(companyAId, userAId, "CHECK_IN");
    await expect(
      prisma.checkInEvidenceAttachment.create({
        data: {
          companyId: companyBId,
          checkInId: checkInBId,
          fileAssetId: assetA.id,
          category: "FRONT",
          sequence: 1,
          createdByUserId: userBId,
        },
      }),
    ).rejects.toBeDefined();
  });

  it("vincula múltiplas fotos à avaria, mas não aceita outro Check-in", async () => {
    for (const sequence of [1, 2]) {
      const asset = await createAsset(companyAId, userAId, "CHECK_IN_DAMAGE");
      await prisma.checkInDamageEvidenceAttachment.create({
        data: {
          companyId: companyAId,
          checkInId: checkInAId,
          damageId: damageAId,
          fileAssetId: asset.id,
          sequence,
          createdByUserId: userAId,
        },
      });
    }
    expect(
      await prisma.checkInDamageEvidenceAttachment.count({
        where: { companyId: companyAId, damageId: damageAId },
      }),
    ).toBe(2);

    const wrongCheckInAsset = await createAsset(
      companyAId,
      userAId,
      "CHECK_IN_DAMAGE",
    );
    await expect(
      prisma.checkInDamageEvidenceAttachment.create({
        data: {
          companyId: companyAId,
          checkInId: checkInA2Id,
          damageId: damageAId,
          fileAssetId: wrongCheckInAsset.id,
          sequence: 3,
          createdByUserId: userAId,
        },
      }),
    ).rejects.toBeDefined();
  });

  it("não reutiliza FileAsset no mesmo tipo nem entre tipos", async () => {
    const damageAsset = await createAsset(
      companyAId,
      userAId,
      "CHECK_IN_DAMAGE",
    );
    await prisma.checkInDamageEvidenceAttachment.create({
      data: {
        companyId: companyAId,
        checkInId: checkInAId,
        damageId: damageAId,
        fileAssetId: damageAsset.id,
        sequence: 10,
        createdByUserId: userAId,
      },
    });
    await expect(
      prisma.checkInDamageEvidenceAttachment.create({
        data: {
          companyId: companyAId,
          checkInId: checkInAId,
          damageId: damageAId,
          fileAssetId: damageAsset.id,
          sequence: 11,
          createdByUserId: userAId,
        },
      }),
    ).rejects.toBeDefined();
    await expect(
      prisma.checkInEvidenceAttachment.create({
        data: {
          companyId: companyAId,
          checkInId: checkInAId,
          fileAssetId: damageAsset.id,
          fileOwnershipType: "CHECK_IN_DAMAGE",
          category: "OTHER",
          sequence: 10,
          createdByUserId: userAId,
        },
      }),
    ).rejects.toBeDefined();
  });

  it.each([
    ["size inválido", { sizeBytes: 0n }],
    ["SHA inválido", { sha256: "xyz" }],
  ] as const)("rejeita %s", async (_label, override) => {
    await expect(
      createAsset(companyAId, userAId, null, override),
    ).rejects.toBeDefined();
  });

  it("rejeita sequence inválida", async () => {
    const asset = await createAsset(companyAId, userAId, "CHECK_IN");
    await expect(
      prisma.checkInEvidenceAttachment.create({
        data: {
          companyId: companyAId,
          checkInId: checkInAId,
          fileAssetId: asset.id,
          category: "OTHER",
          sequence: 0,
          createdByUserId: userAId,
        },
      }),
    ).rejects.toBeDefined();
  });
});

async function createTenantGraph(
  suffix: string,
  companyId: string,
  branchId: string,
  userId: string,
  checkInIds: string[],
) {
  const customerId = randomUUID();
  const vehicleId = randomUUID();
  await prisma.company.create({
    data: {
      id: companyId,
      code: `files-${suffix}-${companyId}`,
      legalName: `Empresa ${suffix}`,
      tradeName: `Empresa ${suffix}`,
    },
  });
  await prisma.branch.create({
    data: { id: branchId, companyId, code: suffix, name: `Filial ${suffix}` },
  });
  await prisma.user.create({
    data: {
      id: userId,
      companyId,
      defaultBranchId: branchId,
      name: `Usuário ${suffix}`,
      email: `${userId}@example.invalid`,
      passwordHash: "x",
    },
  });
  await prisma.customer.create({
    data: { id: customerId, companyId, name: `Cliente ${suffix}` },
  });
  await prisma.vehicle.create({
    data: {
      id: vehicleId,
      companyId,
      customerId,
      brand: "MovenCar",
      model: suffix,
    },
  });
  for (const [index, checkInId] of checkInIds.entries()) {
    const workOrderId = randomUUID();
    await prisma.workOrder.create({
      data: {
        id: workOrderId,
        companyId,
        branchId,
        customerId,
        vehicleId,
        attendantUserId: userId,
        number: index + 100,
        purpose: "INSPECTION",
      },
    });
    await prisma.vehicleCheckIn.create({
      data: {
        id: checkInId,
        companyId,
        branchId,
        workOrderId,
        vehicleId,
        customerId,
        createdByUserId: userId,
      },
    });
  }
}

async function createAsset(
  companyId: string,
  uploadedByUserId: string,
  ownershipType: "CHECK_IN" | "CHECK_IN_DAMAGE" | null,
  override: Partial<{
    storageKey: string;
    sizeBytes: bigint;
    sha256: string;
  }> = {},
) {
  return prisma.fileAsset.create({
    data: {
      companyId,
      storageKey: override.storageKey ?? `objects/${randomUUID()}.jpg`,
      originalFilename: "evidencia.jpg",
      declaredMimeType: "image/jpeg",
      detectedMimeType: "image/jpeg",
      canonicalExtension: "jpg",
      sizeBytes: override.sizeBytes ?? 100n,
      sha256: override.sha256 ?? "a".repeat(64),
      ownershipType,
      uploadedByUserId,
    },
  });
}
