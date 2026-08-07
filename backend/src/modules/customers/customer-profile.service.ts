import type { Prisma } from "@prisma/client";
import { Prisma as PrismaRuntime } from "@prisma/client";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { getCustomer, type Actor } from "./customers.service.js";
import type {
  CommunicationPreferenceInput,
  ConsentInput,
  ContactInput,
  DuplicateQuery,
  FiscalProfileInput,
  IdentityProfileInput,
  RelationshipInput,
} from "./customer-profile.schemas.js";

const identitySelect = {
  id: true,
  rgNumber: true,
  rgIssuer: true,
  rgIssuerState: true,
  rgIssuedAt: true,
  socialName: true,
  nationality: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CustomerIdentityProfileSelect;
const contactSelect = {
  id: true,
  type: true,
  label: true,
  value: true,
  purpose: true,
  isPrimary: true,
  isVerified: true,
  verifiedAt: true,
  verificationSource: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CustomerContactSelect;
const fiscalSelect = {
  id: true,
  taxpayerIndicator: true,
  stateRegistration: true,
  municipalRegistration: true,
  fiscalAddressId: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CustomerFiscalProfileSelect;
const relationshipSelect = {
  id: true,
  type: true,
  validFrom: true,
  validUntil: true,
  notes: true,
  createdAt: true,
  targetCustomer: {
    select: { id: true, name: true, type: true, status: true },
  },
} satisfies Prisma.CustomerRelationshipSelect;
const preferenceSelect = {
  id: true,
  preferredChannel: true,
  acceptsOperationalCalls: true,
  acceptsOperationalWhatsapp: true,
  acceptsOperationalEmail: true,
  preferredTime: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CustomerCommunicationPreferenceSelect;
const consentSelect = {
  id: true,
  type: true,
  version: true,
  status: true,
  grantedAt: true,
  revokedAt: true,
  source: true,
  createdAt: true,
  recordedBy: { select: { id: true, name: true } },
} satisfies Prisma.CustomerConsentSelect;

const audit = (
  actor: Actor,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Prisma.InputJsonValue,
) => ({
  companyId: actor.companyId,
  branchId: actor.branchId,
  actorUserId: actor.userId,
  action,
  entityType,
  entityId,
  metadata,
  ipAddress: actor.ipAddress,
  userAgent: actor.userAgent,
});
const normalizeContact = (type: ContactInput["type"], value: string) =>
  type === "EMAIL" ? value.trim().toLowerCase() : value.replace(/\D/g, "");
const legacyContactField = (type: ContactInput["type"]) =>
  type === "EMAIL" ? "email" : type === "PHONE" ? "phone" : "whatsapp";
const conflict = (error: unknown): never => {
  if (
    error instanceof PrismaRuntime.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
    throw new AppError(
      409,
      "CUSTOMER_PROFILE_CONFLICT",
      "Já existe um registro ativo com estes dados.",
    );
  throw error;
};

export async function getCustomerProfile(
  companyId: string,
  customerId: string,
) {
  const customer = await getCustomer(companyId, customerId);
  const [
    identity,
    contacts,
    addresses,
    fiscal,
    relationships,
    preference,
    consents,
  ] = await prisma.$transaction([
    prisma.customerIdentityProfile.findFirst({
      where: { companyId, customerId },
      select: identitySelect,
    }),
    prisma.customerContact.findMany({
      where: { companyId, customerId, isActive: true },
      select: contactSelect,
      orderBy: [{ type: "asc" }, { isPrimary: "desc" }, { createdAt: "asc" }],
    }),
    prisma.customerAddress.findMany({
      where: { companyId, customerId, deletedAt: null },
      select: {
        id: true,
        type: true,
        label: true,
        postalCode: true,
        street: true,
        number: true,
        complement: true,
        neighborhood: true,
        city: true,
        state: true,
        country: true,
        reference: true,
        ibgeCode: true,
        isPrimary: true,
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    }),
    prisma.customerFiscalProfile.findFirst({
      where: { companyId, customerId },
      select: fiscalSelect,
    }),
    prisma.customerRelationship.findMany({
      where: {
        companyId,
        sourceCustomerId: customerId,
        OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
      },
      select: relationshipSelect,
      orderBy: [{ validFrom: "desc" }, { id: "asc" }],
    }),
    prisma.customerCommunicationPreference.findFirst({
      where: { companyId, customerId },
      select: preferenceSelect,
    }),
    prisma.customerConsent.findMany({
      where: { companyId, customerId },
      select: consentSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
  ]);
  const commonChecks = [
    Boolean(customer.name),
    Boolean(customer.document),
    contacts.some((item) => item.type === "PHONE" || item.type === "WHATSAPP"),
    contacts.some((item) => item.type === "EMAIL"),
    addresses.length > 0,
    consents.length > 0,
  ];
  const typeChecks =
    customer.type === "INDIVIDUAL"
      ? [Boolean(customer.birthDate), Boolean(identity?.rgNumber)]
      : [
          Boolean(fiscal?.stateRegistration),
          fiscal?.taxpayerIndicator != null &&
            fiscal.taxpayerIndicator !== "UNKNOWN",
        ];
  const checks = [...commonChecks, ...typeChecks];
  return {
    customer,
    identity,
    contacts,
    addresses,
    fiscal,
    relationships,
    communicationPreference: preference,
    consents,
    completeness: {
      completed: checks.filter(Boolean).length,
      total: checks.length,
      percentage: Math.round(
        (checks.filter(Boolean).length / checks.length) * 100,
      ),
    },
  };
}

export async function upsertIdentity(
  actor: Actor,
  customerId: string,
  input: IdentityProfileInput,
) {
  const customer = await getCustomer(actor.companyId, customerId);
  if (customer.type !== "INDIVIDUAL")
    throw new AppError(
      400,
      "IDENTITY_PROFILE_INDIVIDUAL_ONLY",
      "Identificação civil disponível apenas para pessoa física.",
    );
  return prisma.$transaction(async (tx) => {
    const profile = await tx.customerIdentityProfile.upsert({
      where: {
        customerId_companyId: { customerId, companyId: actor.companyId },
      },
      create: { ...input, companyId: actor.companyId, customerId },
      update: input,
      select: identitySelect,
    });
    await tx.auditLog.create({
      data: audit(
        actor,
        "CUSTOMER_IDENTITY_UPDATE",
        "CustomerIdentityProfile",
        profile.id,
        { customerId, changedFields: Object.keys(input) },
      ),
    });
    return profile;
  });
}

export async function listContacts(companyId: string, customerId: string) {
  await getCustomer(companyId, customerId);
  return prisma.customerContact.findMany({
    where: { companyId, customerId, isActive: true },
    select: contactSelect,
    orderBy: [{ type: "asc" }, { isPrimary: "desc" }, { createdAt: "asc" }],
  });
}
export async function createContact(
  actor: Actor,
  customerId: string,
  input: ContactInput,
) {
  await getCustomer(actor.companyId, customerId);
  try {
    return await prisma.$transaction(async (tx) => {
      if (input.isPrimary)
        await tx.customerContact.updateMany({
          where: {
            companyId: actor.companyId,
            customerId,
            type: input.type,
            isPrimary: true,
            isActive: true,
          },
          data: { isPrimary: false },
        });
      const contact = await tx.customerContact.create({
        data: {
          ...input,
          companyId: actor.companyId,
          customerId,
          normalizedValue: normalizeContact(input.type, input.value),
          verifiedAt: input.isVerified ? new Date() : null,
          verificationSource: input.isVerified
            ? input.verificationSource
            : null,
        },
        select: contactSelect,
      });
      if (contact.isPrimary)
        await tx.customer.updateMany({
          where: {
            id: customerId,
            companyId: actor.companyId,
            deletedAt: null,
          },
          data: { [legacyContactField(contact.type)]: contact.value },
        });
      await tx.auditLog.create({
        data: audit(
          actor,
          "CUSTOMER_CONTACT_CREATE",
          "CustomerContact",
          contact.id,
          {
            customerId,
            type: contact.type,
            isPrimary: contact.isPrimary,
            isVerified: contact.isVerified,
          },
        ),
      });
      return contact;
    });
  } catch (error) {
    return conflict(error);
  }
}
export async function deactivateContact(
  actor: Actor,
  customerId: string,
  contactId: string,
) {
  await getCustomer(actor.companyId, customerId);
  await prisma.$transaction(async (tx) => {
    const current = await tx.customerContact.findFirst({
      where: {
        id: contactId,
        companyId: actor.companyId,
        customerId,
        isActive: true,
      },
      select: { id: true, type: true, isPrimary: true },
    });
    if (!current)
      throw new AppError(404, "CONTACT_NOT_FOUND", "Contato não encontrado.");
    const changed = await tx.customerContact.updateMany({
      where: {
        id: contactId,
        companyId: actor.companyId,
        customerId,
        isActive: true,
      },
      data: { isActive: false, isPrimary: false },
    });
    if (!changed.count)
      throw new AppError(404, "CONTACT_NOT_FOUND", "Contato não encontrado.");
    if (current.isPrimary)
      await tx.customer.updateMany({
        where: { id: customerId, companyId: actor.companyId, deletedAt: null },
        data: { [legacyContactField(current.type)]: null },
      });
    await tx.auditLog.create({
      data: audit(
        actor,
        "CUSTOMER_CONTACT_UPDATE",
        "CustomerContact",
        contactId,
        { customerId, changedFields: ["isActive"] },
      ),
    });
  });
}

export async function upsertFiscal(
  actor: Actor,
  customerId: string,
  input: FiscalProfileInput,
) {
  await getCustomer(actor.companyId, customerId);
  if (input.fiscalAddressId) {
    const address = await prisma.customerAddress.findFirst({
      where: {
        id: input.fiscalAddressId,
        companyId: actor.companyId,
        customerId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!address)
      throw new AppError(
        404,
        "ADDRESS_NOT_FOUND",
        "Endereço fiscal não encontrado.",
      );
  }
  return prisma.$transaction(async (tx) => {
    const profile = await tx.customerFiscalProfile.upsert({
      where: {
        customerId_companyId: { customerId, companyId: actor.companyId },
      },
      create: { ...input, companyId: actor.companyId, customerId },
      update: input,
      select: fiscalSelect,
    });
    if (input.stateRegistration !== undefined)
      await tx.customer.updateMany({
        where: { id: customerId, companyId: actor.companyId, deletedAt: null },
        data: { stateRegistration: input.stateRegistration },
      });
    await tx.auditLog.create({
      data: audit(
        actor,
        "CUSTOMER_FISCAL_UPDATE",
        "CustomerFiscalProfile",
        profile.id,
        { customerId, changedFields: Object.keys(input) },
      ),
    });
    return profile;
  });
}

export async function createRelationship(
  actor: Actor,
  customerId: string,
  input: RelationshipInput,
) {
  if (customerId === input.targetCustomerId)
    throw new AppError(
      400,
      "RELATIONSHIP_SELF_REFERENCE",
      "Cliente não pode se relacionar consigo mesmo.",
    );
  await Promise.all([
    getCustomer(actor.companyId, customerId),
    getCustomer(actor.companyId, input.targetCustomerId),
  ]);
  try {
    return await prisma.$transaction(async (tx) => {
      const relationship = await tx.customerRelationship.create({
        data: {
          ...input,
          companyId: actor.companyId,
          sourceCustomerId: customerId,
          validFrom: input.validFrom ?? new Date(),
        },
        select: relationshipSelect,
      });
      await tx.auditLog.create({
        data: audit(
          actor,
          "CUSTOMER_RELATIONSHIP_CREATE",
          "CustomerRelationship",
          relationship.id,
          {
            customerId,
            targetCustomerId: input.targetCustomerId,
            type: input.type,
          },
        ),
      });
      return relationship;
    });
  } catch (error) {
    return conflict(error);
  }
}

export async function upsertCommunicationPreference(
  actor: Actor,
  customerId: string,
  input: CommunicationPreferenceInput,
) {
  await getCustomer(actor.companyId, customerId);
  return prisma.$transaction(async (tx) => {
    const preference = await tx.customerCommunicationPreference.upsert({
      where: {
        customerId_companyId: { customerId, companyId: actor.companyId },
      },
      create: { ...input, companyId: actor.companyId, customerId },
      update: input,
      select: preferenceSelect,
    });
    await tx.auditLog.create({
      data: audit(
        actor,
        "CUSTOMER_COMMUNICATION_UPDATE",
        "CustomerCommunicationPreference",
        preference.id,
        { customerId, changedFields: Object.keys(input) },
      ),
    });
    return preference;
  });
}

export async function recordConsent(
  actor: Actor,
  customerId: string,
  input: ConsentInput,
  operationKey?: string,
) {
  await getCustomer(actor.companyId, customerId);
  const match = (existing: {
    type: string;
    version: string;
    status: string;
    source: string;
    grantedAt: Date | null;
    revokedAt: Date | null;
  }) => {
    const occurredAt =
      input.status === "GRANTED" ? existing.grantedAt : existing.revokedAt;
    if (
      existing.type !== input.type ||
      existing.version !== input.version ||
      existing.status !== input.status ||
      existing.source !== input.source ||
      occurredAt?.getTime() !== input.occurredAt.getTime()
    )
      throw new AppError(
        409,
        "IDEMPOTENCY_KEY_REUSED",
        "A chave de idempotência já foi usada em outra operação.",
      );
  };
  const withoutOperationKey = <T extends { operationKey: string | null }>({
    operationKey: _operationKey,
    ...value
  }: T) => value;
  if (operationKey) {
    const existing = await prisma.customerConsent.findFirst({
      where: { companyId: actor.companyId, customerId, operationKey },
      select: { ...consentSelect, operationKey: true },
    });
    if (existing) {
      match(existing);
      return withoutOperationKey(existing);
    }
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const consent = await tx.customerConsent.create({
        data: {
          companyId: actor.companyId,
          customerId,
          type: input.type,
          version: input.version,
          status: input.status,
          source: input.source,
          recordedByUserId: actor.userId,
          notes: input.notes,
          operationKey,
          grantedAt: input.status === "GRANTED" ? input.occurredAt : null,
          revokedAt: input.status === "REVOKED" ? input.occurredAt : null,
        },
        select: consentSelect,
      });
      await tx.auditLog.create({
        data: audit(
          actor,
          "CUSTOMER_CONSENT_RECORDED",
          "CustomerConsent",
          consent.id,
          {
            customerId,
            type: input.type,
            version: input.version,
            status: input.status,
          },
        ),
      });
      return consent;
    });
  } catch (error) {
    if (operationKey) {
      const existing = await prisma.customerConsent.findFirst({
        where: { companyId: actor.companyId, customerId, operationKey },
        select: { ...consentSelect, operationKey: true },
      });
      if (existing) {
        match(existing);
        return withoutOperationKey(existing);
      }
    }
    return conflict(error);
  }
}

const maskDocument = (value: string | null) =>
  value
    ? `${"*".repeat(Math.max(0, value.length - 2))}${value.slice(-2)}`
    : null;
const maskContact = (value: string) =>
  value.includes("@")
    ? `${value[0]}***@${value.split("@")[1]}`
    : `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
export async function possibleDuplicates(
  companyId: string,
  input: DuplicateQuery,
) {
  const contactValues = [input.phone, input.email].filter(
    (value): value is string => Boolean(value),
  );
  const customers = await prisma.customer.findMany({
    where: {
      companyId,
      deletedAt: null,
      OR: [
        input.document ? { document: input.document } : undefined,
        contactValues.length
          ? {
              contacts: {
                some: {
                  normalizedValue: { in: contactValues },
                  isActive: true,
                },
              },
            }
          : undefined,
      ].filter(Boolean) as Prisma.CustomerWhereInput[],
    },
    select: {
      id: true,
      name: true,
      document: true,
      contacts: {
        where: { normalizedValue: { in: contactValues }, isActive: true },
        select: { type: true, normalizedValue: true },
      },
    },
    take: 20,
  });
  return customers.map((customer) => ({
    customerId: customer.id,
    name: customer.name,
    matches: [
      input.document && customer.document === input.document
        ? "DOCUMENT"
        : null,
      ...customer.contacts.map((contact) => contact.type),
    ].filter(Boolean),
    document: maskDocument(customer.document),
    contacts: customer.contacts.map((contact) => ({
      type: contact.type,
      value: maskContact(contact.normalizedValue),
    })),
  }));
}
