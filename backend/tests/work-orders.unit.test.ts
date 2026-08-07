import { describe, expect, it } from "vitest";
import {
  closeWorkOrderSchema,
  createCheckInSchema,
  createConcernSchema,
  createWorkOrderSchema,
  idempotencyKeySchema,
  listWorkOrdersSchema,
} from "../src/modules/work-orders/work-orders.schemas.js";

const id = "11111111-1111-4111-8111-111111111111";

describe("work order intake validation", () => {
  it("accepts diagnostic purpose and rejects request companyId", () => {
    const parsed = createWorkOrderSchema.parse({
      companyId: "company-b",
      customerId: id,
      vehicleId: id,
      purpose: "DIAGNOSTIC",
    });
    expect(parsed.purpose).toBe("DIAGNOSTIC");
    expect(parsed).not.toHaveProperty("companyId");
  });

  it("requires a closing reason when no service was performed", () => {
    expect(closeWorkOrderSchema.parse({ outcome: "COMPLETED" })).toEqual({
      outcome: "COMPLETED",
    });
    expect(() => closeWorkOrderSchema.parse({ outcome: "NO_SERVICE" })).toThrow();
    expect(
      closeWorkOrderSchema.parse({ outcome: "NO_SERVICE", closingReason: "PRICE" }),
    ).toMatchObject({ closingReason: "PRICE" });
  });

  it("validates concerns, fuel, mileage, pagination and idempotency", () => {
    expect(() => createConcernSchema.parse({ description: " " })).toThrow();
    expect(() => createCheckInSchema.parse({ fuelLevel: 101 })).toThrow();
    expect(() => createCheckInSchema.parse({ mileage: -1 })).toThrow();
    expect(() => listWorkOrdersSchema.parse({ limit: 101 })).toThrow();
    expect(idempotencyKeySchema.parse("intake:device:123")).toBe(
      "intake:device:123",
    );
  });
});
