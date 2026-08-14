import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const locations = [
  "FRONT_LEFT_HEADLIGHT",
  "FRONT_RIGHT_HEADLIGHT",
  "REAR_LEFT_TAILLIGHT",
  "REAR_RIGHT_TAILLIGHT",
] as const;

const sources = [
  readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
  readFileSync(
    new URL(
      "../prisma/migrations/20260814100000_add_checkin_headlights_taillights/migration.sql",
      import.meta.url,
    ),
    "utf8",
  ),
  readFileSync(
    new URL(
      "../src/modules/work-orders/work-orders.schemas.ts",
      import.meta.url,
    ),
    "utf8",
  ),
  readFileSync(
    new URL("../../src/services/workshop.ts", import.meta.url),
    "utf8",
  ),
  readFileSync(
    new URL("../../src/pages/CheckInPage.tsx", import.meta.url),
    "utf8",
  ),
];

describe("damage map location contract", () => {
  it.each(locations)("keeps %s consistent across database, API and UI", (location) => {
    for (const source of sources) expect(source).toContain(location);
  });

  it("uses additive PostgreSQL enum changes without replacing the enum", () => {
    const migration = sources[1];
    expect(migration.match(/ALTER TYPE "CheckInDamageLocation"/g)).toHaveLength(4);
    expect(migration.match(/ADD VALUE IF NOT EXISTS/g)).toHaveLength(4);
    expect(migration).not.toContain("DROP TYPE");
  });
});
