import { describe, expect, it } from "vitest";
import { communicationPreferenceSchema, consentSchema, contactSchema, duplicateQuerySchema, identityProfileSchema, relationshipSchema } from "../src/modules/customers/customer-profile.schemas.js";

describe("Customer 360 validation", () => {
  it("preserves identity dates as calendar dates and normalizes RG state", () => {
    const parsed = identityProfileSchema.parse({ rgNumber: "12.345.678-X", rgIssuerState: "sp", rgIssuedAt: "2010-03-09" });
    expect(parsed.rgIssuerState).toBe("SP");
    expect(parsed.rgIssuedAt?.toISOString()).toBe("2010-03-09T00:00:00.000Z");
  });
  it("validates phone, email and verification evidence", () => {
    const parsed = contactSchema.parse({ type: "PHONE", value: "(11) 99999-0000", companyId: "company-b" });
    expect(parsed).toMatchObject({ isVerified: false });
    expect(parsed).not.toHaveProperty("companyId");
    expect(() => contactSchema.parse({ type: "PHONE", value: "12" })).toThrow();
    expect(() => contactSchema.parse({ type: "EMAIL", value: "invalid" })).toThrow();
    expect(() => contactSchema.parse({ type: "EMAIL", value: "a@b.com", isVerified: true })).toThrow();
  });
  it("keeps operational preference separate from consent events", () => {
    expect(communicationPreferenceSchema.parse({ preferredChannel: "WHATSAPP" })).toMatchObject({ preferredChannel: "WHATSAPP" });
    expect(consentSchema.parse({ type: "MARKETING_WHATSAPP", version: "1", status: "REVOKED", source: "IN_PERSON", occurredAt: "2026-01-01T12:00:00Z" })).toMatchObject({ status: "REVOKED" });
  });
  it("validates relationship periods and duplicate inputs", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(() => relationshipSchema.parse({ targetCustomerId: id, type: "DRIVER", validFrom: "2026-02-01", validUntil: "2026-01-01" })).toThrow();
    expect(duplicateQuerySchema.parse({ phone: "(11) 99999-0000" }).phone).toBe("11999990000");
    expect(() => duplicateQuerySchema.parse({})).toThrow();
  });
});
