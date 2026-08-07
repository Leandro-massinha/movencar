import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { createAddress, createCustomer, type Actor } from "../src/modules/customers/customers.service.js";
import { createContact, createRelationship, getCustomerProfile, possibleDuplicates, recordConsent, upsertFiscal, upsertIdentity } from "../src/modules/customers/customer-profile.service.js";

const suite = process.env.CUSTOMER_PROFILE_DATABASE_TESTS === "1" ? describe : describe.skip;

suite("Customer 360 PostgreSQL invariants", () => {
  const companyId = randomUUID(), companyBId = randomUUID(), branchId = randomUUID(), branchBId = randomUUID(), userId = randomUUID();
  const customerId = randomUUID(), companyCustomerId = randomUUID(), customerBId = randomUUID();
  const actor: Actor = { companyId, branchId, userId };

  beforeAll(async () => {
    await prisma.company.createMany({ data: [
      { id: companyId, code: `a-${companyId}`, legalName: "Empresa A", tradeName: "Empresa A" },
      { id: companyBId, code: `b-${companyBId}`, legalName: "Empresa B", tradeName: "Empresa B" },
    ] });
    await prisma.branch.createMany({ data: [
      { id: branchId, companyId, code: "A", name: "Filial A" },
      { id: branchBId, companyId: companyBId, code: "B", name: "Filial B" },
    ] });
    await prisma.user.create({ data: { id: userId, companyId, defaultBranchId: branchId, name: "Auditor", email: `${userId}@example.invalid`, passwordHash: "x" } });
    await prisma.customer.createMany({ data: [
      { id: customerId, companyId, type: "INDIVIDUAL", name: "Maria Auditada", document: "52998224725", birthDate: new Date("1990-05-17T00:00:00.000Z") },
      { id: companyCustomerId, companyId, type: "COMPANY", name: "Empresa Cliente", document: "11222333000181" },
      { id: customerBId, companyId: companyBId, type: "INDIVIDUAL", name: "Cliente B", document: "52998224725" },
    ] });
  });
  afterAll(async () => prisma.$disconnect());

  it("persists PF identity and the DATE without changing its day", async () => {
    const identity = await upsertIdentity(actor, customerId, { rgNumber: "12.345.678-X", rgIssuer: "SSP", rgIssuerState: "SP", rgIssuedAt: new Date("2010-03-09T00:00:00.000Z") });
    expect(identity.rgNumber).toBe("12.345.678-X");
    expect(identity.rgIssuedAt?.toISOString().slice(0, 10)).toBe("2010-03-09");
    await expect(upsertIdentity(actor, companyCustomerId, { rgNumber: "x" })).rejects.toMatchObject({ code: "IDENTITY_PROFILE_INDIVIDUAL_ONLY" });
  });

  it("keeps legacy contact writes synchronized during transition", async () => {
    const customer = await createCustomer(actor, { name: "Cadastro progressivo", type: "INDIVIDUAL", status: "ACTIVE", phone: "(11) 98888-7777" });
    expect(await prisma.customerContact.findFirst({ where: { companyId, customerId: customer.id, type: "PHONE" }, select: { normalizedValue: true, isPrimary: true } })).toEqual({ normalizedValue: "11988887777", isPrimary: true });
  });

  it("normalizes contacts and enforces one active primary per type", async () => {
    const first = await createContact(actor, customerId, { type: "PHONE", value: "(11) 99999-0000", purpose: "PERSONAL", isPrimary: true, isVerified: false });
    expect(first).not.toHaveProperty("normalizedValue");
    const results = await Promise.allSettled([
      createContact(actor, customerId, { type: "EMAIL", value: "UM@EXEMPLO.COM", purpose: "PERSONAL", isPrimary: true, isVerified: false }),
      createContact(actor, customerId, { type: "EMAIL", value: "dois@exemplo.com", purpose: "PERSONAL", isPrimary: true, isVerified: false }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2);
    expect(await prisma.customerContact.count({ where: { companyId, customerId, type: "EMAIL", isPrimary: true, isActive: true } })).toBe(1);
  });

  it("keeps fiscal address and relationships tenant-safe", async () => {
    const address = await createAddress(actor, customerId, { street: "Rua Um", city: "São Paulo", state: "SP", type: "FISCAL", isPrimary: true });
    await expect(upsertFiscal(actor, customerId, { fiscalAddressId: randomUUID(), taxpayerIndicator: "TAXPAYER" })).rejects.toMatchObject({ code: "ADDRESS_NOT_FOUND" });
    await expect(upsertFiscal(actor, customerId, { fiscalAddressId: address.id, taxpayerIndicator: "TAXPAYER", stateRegistration: "ISENTO" })).resolves.toMatchObject({ fiscalAddressId: address.id });
    await expect(createRelationship(actor, customerId, { targetCustomerId: customerId, type: "SPOUSE" })).rejects.toMatchObject({ code: "RELATIONSHIP_SELF_REFERENCE" });
    await expect(createRelationship(actor, customerId, { targetCustomerId: customerBId, type: "AUTHORIZED_CONTACT" })).rejects.toMatchObject({ code: "CUSTOMER_NOT_FOUND" });
  });

  it("preserves consent history and excludes PII from audit metadata", async () => {
    await recordConsent(actor, customerId, { type: "PRIVACY_POLICY", version: "1", status: "GRANTED", source: "IN_PERSON", occurredAt: new Date("2026-01-01T10:00:00Z") });
    await recordConsent(actor, customerId, { type: "PRIVACY_POLICY", version: "1", status: "REVOKED", source: "IN_PERSON", occurredAt: new Date("2026-02-01T10:00:00Z") });
    expect(await prisma.customerConsent.count({ where: { companyId, customerId, type: "PRIVACY_POLICY" } })).toBe(2);
    const logs = await prisma.auditLog.findMany({ where: { companyId, entityType: { in: ["CustomerContact", "CustomerConsent", "CustomerIdentityProfile"] } }, select: { metadata: true } });
    expect(JSON.stringify(logs)).not.toContain("52998224725");
    expect(JSON.stringify(logs)).not.toContain("999990000");
    expect(JSON.stringify(logs)).not.toContain("12.345.678-X");
  });

  it("detects only same-tenant duplicates with masked evidence and calculates completeness", async () => {
    const byDocument = await possibleDuplicates(companyId, { document: "52998224725" });
    expect(byDocument).toHaveLength(1);
    expect(byDocument[0]).toMatchObject({ customerId, document: "*********25" });
    expect(await possibleDuplicates(companyBId, { email: "um@exemplo.com" })).toEqual([]);
    const profile = await getCustomerProfile(companyId, customerId);
    expect(profile.completeness.percentage).toBeGreaterThan(0);
    expect(profile.customer.birthDate?.toISOString().slice(0, 10)).toBe("1990-05-17");
  });
});
