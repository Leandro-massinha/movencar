import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import {
  createAddress,
  createCustomer,
  updateAddress,
  type Actor,
} from "../src/modules/customers/customers.service.js";
import {
  createContact,
  createRelationship,
  getCustomerProfile,
  possibleDuplicates,
  recordConsent,
  upsertCommunicationPreference,
  upsertFiscal,
  upsertIdentity,
} from "../src/modules/customers/customer-profile.service.js";

const suite =
  process.env.CUSTOMER_PROFILE_DATABASE_TESTS === "1"
    ? describe
    : describe.skip;

suite("Customer 360 PostgreSQL invariants", () => {
  const companyId = randomUUID(),
    companyBId = randomUUID(),
    branchId = randomUUID(),
    branchBId = randomUUID(),
    userId = randomUUID();
  const customerId = randomUUID(),
    companyCustomerId = randomUUID(),
    customerBId = randomUUID();
  const actor: Actor = { companyId, branchId, userId };

  beforeAll(async () => {
    await prisma.company.createMany({
      data: [
        {
          id: companyId,
          code: `a-${companyId}`,
          legalName: "Empresa A",
          tradeName: "Empresa A",
        },
        {
          id: companyBId,
          code: `b-${companyBId}`,
          legalName: "Empresa B",
          tradeName: "Empresa B",
        },
      ],
    });
    await prisma.branch.createMany({
      data: [
        { id: branchId, companyId, code: "A", name: "Filial A" },
        { id: branchBId, companyId: companyBId, code: "B", name: "Filial B" },
      ],
    });
    await prisma.user.create({
      data: {
        id: userId,
        companyId,
        defaultBranchId: branchId,
        name: "Auditor",
        email: `${userId}@example.invalid`,
        passwordHash: "x",
      },
    });
    await prisma.customer.createMany({
      data: [
        {
          id: customerId,
          companyId,
          type: "INDIVIDUAL",
          name: "Maria Auditada",
          document: "52998224725",
          birthDate: new Date("1990-05-17T00:00:00.000Z"),
        },
        {
          id: companyCustomerId,
          companyId,
          type: "COMPANY",
          name: "Empresa Cliente",
          document: "11222333000181",
        },
        {
          id: customerBId,
          companyId: companyBId,
          type: "INDIVIDUAL",
          name: "Cliente B",
          document: "52998224725",
        },
      ],
    });
  });
  afterAll(async () => prisma.$disconnect());

  it("persists PF identity and the DATE without changing its day", async () => {
    const identity = await upsertIdentity(actor, customerId, {
      rgNumber: "12.345.678-X",
      rgIssuer: "SSP",
      rgIssuerState: "SP",
      rgIssuedAt: new Date("2010-03-09T00:00:00.000Z"),
    });
    expect(identity.rgNumber).toBe("12.345.678-X");
    expect(identity.rgIssuedAt?.toISOString().slice(0, 10)).toBe("2010-03-09");
    await expect(
      upsertIdentity(actor, companyCustomerId, { rgNumber: "x" }),
    ).rejects.toMatchObject({ code: "IDENTITY_PROFILE_INDIVIDUAL_ONLY" });
  });

  it("keeps legacy contact writes synchronized during transition", async () => {
    const customer = await createCustomer(actor, {
      name: "Cadastro progressivo",
      type: "INDIVIDUAL",
      status: "ACTIVE",
      phone: "(11) 98888-7777",
    });
    expect(
      await prisma.customerContact.findFirst({
        where: { companyId, customerId: customer.id, type: "PHONE" },
        select: { normalizedValue: true, isPrimary: true },
      }),
    ).toEqual({ normalizedValue: "11988887777", isPrimary: true });
  });

  it("normalizes contacts and enforces one active primary per type", async () => {
    const first = await createContact(actor, customerId, {
      type: "PHONE",
      value: "(11) 99999-0000",
      purpose: "PERSONAL",
      isPrimary: true,
      isVerified: false,
    });
    expect(first).not.toHaveProperty("normalizedValue");
    const results = await Promise.allSettled([
      createContact(actor, customerId, {
        type: "EMAIL",
        value: "UM@EXEMPLO.COM",
        purpose: "PERSONAL",
        isPrimary: true,
        isVerified: false,
      }),
      createContact(actor, customerId, {
        type: "EMAIL",
        value: "dois@exemplo.com",
        purpose: "PERSONAL",
        isPrimary: true,
        isVerified: false,
      }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled").length,
    ).toBeGreaterThanOrEqual(1);
    for (const result of results.filter(
      (item): item is PromiseRejectedResult => item.status === "rejected",
    ))
      expect(result.reason).toMatchObject({
        status: 409,
        code: "CUSTOMER_PROFILE_CONFLICT",
      });
    expect(
      await prisma.customerContact.count({
        where: {
          companyId,
          customerId,
          type: "EMAIL",
          isPrimary: true,
          isActive: true,
        },
      }),
    ).toBe(1);
    expect(
      await prisma.customerContact.findFirst({
        where: { id: first.id },
        select: { normalizedValue: true },
      }),
    ).toEqual({ normalizedValue: "11999990000" });
    for (const type of ["PHONE", "WHATSAPP"] as const) {
      const primaryResults = await Promise.allSettled([
        createContact(actor, customerId, {
          type,
          value: "11 98888-1111",
          purpose: "PERSONAL",
          isPrimary: true,
          isVerified: false,
        }),
        createContact(actor, customerId, {
          type,
          value: "11 97777-2222",
          purpose: "PERSONAL",
          isPrimary: true,
          isVerified: false,
        }),
      ]);
      expect(
        primaryResults.some((result) => result.status === "fulfilled"),
      ).toBe(true);
      expect(
        await prisma.customerContact.count({
          where: {
            companyId,
            customerId,
            type,
            isPrimary: true,
            isActive: true,
          },
        }),
      ).toBe(1);
    }
  });

  it("keeps document and 1:1 profiles unique under concurrency", async () => {
    const duplicateDocument = "11144477735";
    const documents = await Promise.allSettled([
      createCustomer(actor, {
        name: "Documento 1",
        type: "INDIVIDUAL",
        status: "ACTIVE",
        document: duplicateDocument,
      }),
      createCustomer(actor, {
        name: "Documento 2",
        type: "INDIVIDUAL",
        status: "ACTIVE",
        document: duplicateDocument,
      }),
    ]);
    expect(
      documents.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    await Promise.all([
      upsertIdentity(actor, customerId, { rgIssuer: "SSP" }),
      upsertIdentity(actor, customerId, { nationality: "Brasileira" }),
      upsertFiscal(actor, customerId, { taxpayerIndicator: "EXEMPT" }),
      upsertFiscal(actor, customerId, { municipalRegistration: "123" }),
      upsertCommunicationPreference(actor, customerId, {
        preferredChannel: "PHONE",
      }),
      upsertCommunicationPreference(actor, customerId, {
        preferredChannel: "EMAIL",
      }),
    ]);
    expect(
      await prisma.customerIdentityProfile.count({
        where: { companyId, customerId },
      }),
    ).toBe(1);
    expect(
      await prisma.customerFiscalProfile.count({
        where: { companyId, customerId },
      }),
    ).toBe(1);
    expect(
      await prisma.customerCommunicationPreference.count({
        where: { companyId, customerId },
      }),
    ).toBe(1);
  });

  it("keeps fiscal address and relationships tenant-safe", async () => {
    const address = await createAddress(actor, customerId, {
      street: "Rua Um",
      city: "São Paulo",
      state: "SP",
      type: "FISCAL",
      isPrimary: true,
    });
    await expect(
      upsertFiscal(actor, customerId, {
        fiscalAddressId: randomUUID(),
        taxpayerIndicator: "TAXPAYER",
      }),
    ).rejects.toMatchObject({ code: "ADDRESS_NOT_FOUND" });
    await expect(
      upsertFiscal(actor, customerId, {
        fiscalAddressId: address.id,
        taxpayerIndicator: "TAXPAYER",
        stateRegistration: "ISENTO",
      }),
    ).resolves.toMatchObject({ fiscalAddressId: address.id });
    await expect(
      createRelationship(actor, customerId, {
        targetCustomerId: customerId,
        type: "SPOUSE",
      }),
    ).rejects.toMatchObject({ code: "RELATIONSHIP_SELF_REFERENCE" });
    await expect(
      createRelationship(actor, customerId, {
        targetCustomerId: customerBId,
        type: "AUTHORIZED_CONTACT",
      }),
    ).rejects.toMatchObject({ code: "CUSTOMER_NOT_FOUND" });
    const duplicateRelationships = await Promise.allSettled([
      createRelationship(actor, customerId, {
        targetCustomerId: companyCustomerId,
        type: "FLEET_MANAGER",
      }),
      createRelationship(actor, customerId, {
        targetCustomerId: companyCustomerId,
        type: "FLEET_MANAGER",
      }),
    ]);
    expect(
      duplicateRelationships.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
  });

  it("keeps one primary address under concurrent promotion", async () => {
    const [first, second] = await Promise.all([
      createAddress(actor, customerId, {
        street: "Rua A",
        city: "São Paulo",
        state: "SP",
      }),
      createAddress(actor, customerId, {
        street: "Rua B",
        city: "São Paulo",
        state: "SP",
      }),
    ]);
    const promotions = await Promise.allSettled([
      updateAddress(actor, customerId, first.id, { isPrimary: true }),
      updateAddress(actor, customerId, second.id, { isPrimary: true }),
    ]);
    expect(promotions.some((result) => result.status === "fulfilled")).toBe(
      true,
    );
    for (const result of promotions.filter(
      (item) => item.status === "rejected",
    ))
      expect((result as PromiseRejectedResult).reason).toMatchObject({
        status: 409,
        code: "ADDRESS_PRIMARY_CONFLICT",
      });
    expect(
      await prisma.customerAddress.count({
        where: { companyId, customerId, isPrimary: true, deletedAt: null },
      }),
    ).toBe(1);
  });

  it("preserves consent history and excludes PII from audit metadata", async () => {
    await recordConsent(actor, customerId, {
      type: "PRIVACY_POLICY",
      version: "1",
      status: "GRANTED",
      source: "IN_PERSON",
      occurredAt: new Date("2026-01-01T10:00:00Z"),
    });
    await recordConsent(actor, customerId, {
      type: "PRIVACY_POLICY",
      version: "1",
      status: "REVOKED",
      source: "IN_PERSON",
      occurredAt: new Date("2026-02-01T10:00:00Z"),
    });
    const retryInput = {
      type: "MARKETING_EMAIL" as const,
      version: "1",
      status: "GRANTED" as const,
      source: "IN_PERSON" as const,
      occurredAt: new Date("2026-03-01T10:00:00Z"),
    };
    const [retryA, retryB] = await Promise.all([
      recordConsent(actor, customerId, retryInput, "consent:retry:1"),
      recordConsent(actor, customerId, retryInput, "consent:retry:1"),
    ]);
    expect(retryA.id).toBe(retryB.id);
    expect(retryA).not.toHaveProperty("operationKey");
    expect(
      await prisma.customerConsent.count({
        where: { companyId, customerId, type: "PRIVACY_POLICY" },
      }),
    ).toBe(2);
    expect(
      await prisma.customerConsent.count({
        where: { companyId, customerId, type: "MARKETING_EMAIL" },
      }),
    ).toBe(1);
    const logs = await prisma.auditLog.findMany({
      where: {
        companyId,
        entityType: {
          in: ["CustomerContact", "CustomerConsent", "CustomerIdentityProfile"],
        },
      },
      select: { metadata: true },
    });
    expect(JSON.stringify(logs)).not.toContain("52998224725");
    expect(JSON.stringify(logs)).not.toContain("999990000");
    expect(JSON.stringify(logs)).not.toContain("12.345.678-X");
  });

  it("detects only same-tenant duplicates with masked evidence and calculates completeness", async () => {
    const byDocument = await possibleDuplicates(companyId, {
      document: "52998224725",
    });
    expect(byDocument).toHaveLength(1);
    expect(byDocument[0]).toMatchObject({
      customerId,
      document: "*********25",
    });
    const activeEmail = await prisma.customerContact.findFirstOrThrow({
      where: { companyId, customerId, type: "EMAIL", isActive: true },
      select: { normalizedValue: true },
    });
    expect(
      await possibleDuplicates(companyBId, {
        email: activeEmail.normalizedValue,
      }),
    ).toEqual([]);
    expect(
      (await possibleDuplicates(companyId, { phone: "11999990000" }))[0]
        .contacts[0].value,
    ).toMatch(/0000$/);
    expect(
      await possibleDuplicates(companyId, {
        email: activeEmail.normalizedValue,
      }),
    ).not.toHaveLength(0);
    const profile = await getCustomerProfile(companyId, customerId);
    expect(profile.completeness.percentage).toBeGreaterThan(0);
    expect(profile.customer.birthDate?.toISOString().slice(0, 10)).toBe(
      "1990-05-17",
    );
    const companyProfile = await getCustomerProfile(
      companyId,
      companyCustomerId,
    );
    expect(companyProfile.completeness.total).toBe(profile.completeness.total);
  });
});
