import { describe, it, expect } from "vitest";
import { z } from "zod/v4";

/**
 * We replicate the Zod schemas here because the source files are "use server"
 * modules that can't be imported in a Node test environment.
 * These tests validate the schema logic itself (constraints, defaults, enums).
 */

// ── Workspace Schemas ───────────────────────────────────

const CreateWorkspaceSchema = z.object({
  name: z.string().min(2).max(100),
});

/**
 * Replicated slug generator from workspace-actions.ts
 */
function generateSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[\s\u3000]+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .replace(/[^a-z0-9-]/g, "");

  const cleaned = slug
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");

  if (cleaned.length < 2) {
    const rand = Math.random().toString(36).slice(2, 10);
    return `ws-${rand}`;
  }

  return cleaned.slice(0, 50);
}

describe("CreateWorkspaceSchema", () => {
  it("accepts valid workspace name", () => {
    const result = CreateWorkspaceSchema.safeParse({
      name: "My Workspace",
    });
    expect(result.success).toBe(true);
  });

  it("rejects name shorter than 2 chars", () => {
    const result = CreateWorkspaceSchema.safeParse({ name: "A" });
    expect(result.success).toBe(false);
  });
});

describe("generateSlug", () => {
  it("converts English name to lowercase hyphenated slug", () => {
    expect(generateSlug("My Company")).toBe("my-company");
  });

  it("handles uppercase and spaces", () => {
    expect(generateSlug("ABC Corp Ltd")).toBe("abc-corp-ltd");
  });

  it("strips special characters", () => {
    expect(generateSlug("test@company!")).toBe("testcompany");
  });

  it("collapses multiple hyphens", () => {
    expect(generateSlug("a  -  b")).toBe("a-b");
  });

  it("trims leading and trailing hyphens", () => {
    expect(generateSlug(" -hello- ")).toBe("hello");
  });

  it("falls back to random slug for all-Japanese name", () => {
    const slug = generateSlug("株式会社サンプル");
    expect(slug).toMatch(/^ws-[a-z0-9]+$/);
  });

  it("keeps alphanumeric from mixed Japanese-English name", () => {
    const slug = generateSlug("ABC商事");
    expect(slug).toBe("abc");
  });

  it("handles fullwidth spaces", () => {
    expect(generateSlug("test\u3000company")).toBe("test-company");
  });

  it("truncates to 50 chars", () => {
    const long = "a".repeat(60);
    expect(generateSlug(long).length).toBeLessThanOrEqual(50);
  });
});

// ── Organization Schemas ────────────────────────────────

const OrgSchema = z.object({
  legalName: z.string().min(1, "法人名は必須です"),
  displayName: z.string().min(1, "表示名は必須です"),
  orgType: z.enum([
    "buyer",
    "supplier",
    "customer",
    "partner",
    "logistics",
    "internal",
  ]),
  countryCode: z.string().max(3).optional(),
  website: z.string().url().optional().or(z.literal("")),
});

describe("OrgSchema", () => {
  it("accepts valid organization", () => {
    const result = OrgSchema.safeParse({
      legalName: "ACME Corp",
      displayName: "ACME",
      orgType: "supplier",
      countryCode: "JPN",
      website: "https://acme.example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty legal name", () => {
    const result = OrgSchema.safeParse({
      legalName: "",
      displayName: "Test",
      orgType: "buyer",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid org type", () => {
    const result = OrgSchema.safeParse({
      legalName: "Test",
      displayName: "Test",
      orgType: "unknown",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid org types", () => {
    const types = [
      "buyer",
      "supplier",
      "customer",
      "partner",
      "logistics",
      "internal",
    ];
    for (const orgType of types) {
      const result = OrgSchema.safeParse({
        legalName: "Test",
        displayName: "Test",
        orgType,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid URL for website", () => {
    const result = OrgSchema.safeParse({
      legalName: "Test",
      displayName: "Test",
      orgType: "buyer",
      website: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty string for website", () => {
    const result = OrgSchema.safeParse({
      legalName: "Test",
      displayName: "Test",
      orgType: "buyer",
      website: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts country code up to 3 chars", () => {
    const result = OrgSchema.safeParse({
      legalName: "Test",
      displayName: "Test",
      orgType: "buyer",
      countryCode: "JP",
    });
    expect(result.success).toBe(true);
  });

  it("rejects country code over 3 chars", () => {
    const result = OrgSchema.safeParse({
      legalName: "Test",
      displayName: "Test",
      orgType: "buyer",
      countryCode: "JAPAN",
    });
    expect(result.success).toBe(false);
  });
});

// ── Site Schema ─────────────────────────────────────────

const SiteSchema = z.object({
  name: z.string().min(1, "サイト名は必須です"),
  siteType: z.enum([
    "farm",
    "factory",
    "warehouse",
    "port",
    "mine",
    "office",
    "project_site",
    "store",
    "unknown",
  ]),
  countryCode: z.string().max(3).optional(),
  regionAdmin1: z.string().optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  areaHa: z.coerce.number().min(0).optional(),
  address: z.string().optional(),
});

describe("SiteSchema", () => {
  it("accepts valid site", () => {
    const result = SiteSchema.safeParse({
      name: "Tokyo Factory",
      siteType: "factory",
      countryCode: "JPN",
      lat: 35.6762,
      lng: 139.6503,
      areaHa: 5.0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty site name", () => {
    const result = SiteSchema.safeParse({ name: "", siteType: "farm" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid site type", () => {
    const result = SiteSchema.safeParse({
      name: "Test",
      siteType: "spaceship",
    });
    expect(result.success).toBe(false);
  });

  it("rejects latitude out of range", () => {
    const below = SiteSchema.safeParse({
      name: "Test",
      siteType: "farm",
      lat: -91,
    });
    expect(below.success).toBe(false);

    const above = SiteSchema.safeParse({
      name: "Test",
      siteType: "farm",
      lat: 91,
    });
    expect(above.success).toBe(false);
  });

  it("rejects longitude out of range", () => {
    const below = SiteSchema.safeParse({
      name: "Test",
      siteType: "farm",
      lng: -181,
    });
    expect(below.success).toBe(false);

    const above = SiteSchema.safeParse({
      name: "Test",
      siteType: "farm",
      lng: 181,
    });
    expect(above.success).toBe(false);
  });

  it("accepts boundary latitude values", () => {
    const minLat = SiteSchema.safeParse({
      name: "South Pole",
      siteType: "unknown",
      lat: -90,
    });
    expect(minLat.success).toBe(true);

    const maxLat = SiteSchema.safeParse({
      name: "North Pole",
      siteType: "unknown",
      lat: 90,
    });
    expect(maxLat.success).toBe(true);
  });

  it("coerces string numbers for lat/lng", () => {
    const result = SiteSchema.safeParse({
      name: "Test",
      siteType: "farm",
      lat: "35.5",
      lng: "139.7",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lat).toBe(35.5);
      expect(result.data.lng).toBe(139.7);
    }
  });

  it("rejects negative area", () => {
    const result = SiteSchema.safeParse({
      name: "Test",
      siteType: "farm",
      areaHa: -1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid site types", () => {
    const types = [
      "farm",
      "factory",
      "warehouse",
      "port",
      "mine",
      "office",
      "project_site",
      "store",
      "unknown",
    ];
    for (const siteType of types) {
      const result = SiteSchema.safeParse({ name: "Test", siteType });
      expect(result.success).toBe(true);
    }
  });
});

// ── Supply Relationship Schema ──────────────────────────

const SupplyRelationshipSchema = z.object({
  fromWsOrgId: z.string().uuid("Invalid from organization"),
  toWsOrgId: z.string().uuid("Invalid to organization"),
  tier: z.coerce.number().int().min(0).max(10).optional(),
  relationshipType: z
    .enum(["supplies", "manufactures_for", "ships_for", "sells_to", "owns"])
    .default("supplies"),
  verificationStatus: z
    .enum(["inferred", "declared", "verified"])
    .default("inferred"),
});

describe("SupplyRelationshipSchema", () => {
  const validUUID1 = "550e8400-e29b-41d4-a716-446655440000";
  const validUUID2 = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

  it("accepts valid relationship", () => {
    const result = SupplyRelationshipSchema.safeParse({
      fromWsOrgId: validUUID1,
      toWsOrgId: validUUID2,
      tier: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.relationshipType).toBe("supplies"); // default
      expect(result.data.verificationStatus).toBe("inferred"); // default
    }
  });

  it("rejects non-UUID org IDs", () => {
    const result = SupplyRelationshipSchema.safeParse({
      fromWsOrgId: "not-a-uuid",
      toWsOrgId: validUUID2,
    });
    expect(result.success).toBe(false);
  });

  it("rejects tier above 10", () => {
    const result = SupplyRelationshipSchema.safeParse({
      fromWsOrgId: validUUID1,
      toWsOrgId: validUUID2,
      tier: 11,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative tier", () => {
    const result = SupplyRelationshipSchema.safeParse({
      fromWsOrgId: validUUID1,
      toWsOrgId: validUUID2,
      tier: -1,
    });
    expect(result.success).toBe(false);
  });

  it("coerces string tier to number", () => {
    const result = SupplyRelationshipSchema.safeParse({
      fromWsOrgId: validUUID1,
      toWsOrgId: validUUID2,
      tier: "3",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tier).toBe(3);
    }
  });

  it("accepts all verification statuses", () => {
    for (const vs of ["inferred", "declared", "verified"]) {
      const result = SupplyRelationshipSchema.safeParse({
        fromWsOrgId: validUUID1,
        toWsOrgId: validUUID2,
        verificationStatus: vs,
      });
      expect(result.success).toBe(true);
    }
  });
});

// ── Risk Score Schema ───────────────────────────────────

const RiskScoreSchema = z.object({
  riskId: z.string().uuid(),
  severity: z.number().min(0).max(10),
  likelihood: z.number().min(0).max(10),
  velocity: z.number().min(0).max(10).optional(),
  detectability: z.number().min(0).max(10).optional(),
});

describe("RiskScoreSchema", () => {
  const validRiskId = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts valid risk score", () => {
    const result = RiskScoreSchema.safeParse({
      riskId: validRiskId,
      severity: 8,
      likelihood: 6,
      velocity: 3,
      detectability: 5,
    });
    expect(result.success).toBe(true);
  });

  it("rejects severity above 10", () => {
    const result = RiskScoreSchema.safeParse({
      riskId: validRiskId,
      severity: 11,
      likelihood: 5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative severity", () => {
    const result = RiskScoreSchema.safeParse({
      riskId: validRiskId,
      severity: -1,
      likelihood: 5,
    });
    expect(result.success).toBe(false);
  });

  it("accepts boundary values (0 and 10)", () => {
    const result = RiskScoreSchema.safeParse({
      riskId: validRiskId,
      severity: 0,
      likelihood: 10,
    });
    expect(result.success).toBe(true);
  });

  it("allows optional velocity and detectability", () => {
    const result = RiskScoreSchema.safeParse({
      riskId: validRiskId,
      severity: 5,
      likelihood: 5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.velocity).toBeUndefined();
      expect(result.data.detectability).toBeUndefined();
    }
  });
});

// ── Assessment Schema ───────────────────────────────────

const AssessmentSchema = z.object({
  assessmentCycle: z.string().min(1, "Assessment cycle is required"),
  methodVersion: z.string().min(1, "Method version is required"),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
});

describe("AssessmentSchema", () => {
  it("accepts valid assessment", () => {
    const result = AssessmentSchema.safeParse({
      assessmentCycle: "FY2026",
      methodVersion: "TNFD v1.0",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("draft"); // default
    }
  });

  it("rejects empty assessment cycle", () => {
    const result = AssessmentSchema.safeParse({
      assessmentCycle: "",
      methodVersion: "v1",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid statuses", () => {
    for (const status of ["draft", "active", "archived"]) {
      const result = AssessmentSchema.safeParse({
        assessmentCycle: "FY2026",
        methodVersion: "v1",
        status,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    const result = AssessmentSchema.safeParse({
      assessmentCycle: "FY2026",
      methodVersion: "v1",
      status: "completed",
    });
    expect(result.success).toBe(false);
  });
});

// ── Disclosure Schema ───────────────────────────────────

const DisclosureSchema = z.object({
  assessmentId: z.string().uuid(),
  framework: z.enum(["tnfd", "csrd", "internal"]),
  sectionKey: z.string().min(1, "Section key is required"),
  contentMd: z.string().default(""),
});

describe("DisclosureSchema", () => {
  const validUUID = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts valid disclosure", () => {
    const result = DisclosureSchema.safeParse({
      assessmentId: validUUID,
      framework: "tnfd",
      sectionKey: "governance-a",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contentMd).toBe(""); // default
    }
  });

  it("accepts all framework types", () => {
    for (const framework of ["tnfd", "csrd", "internal"]) {
      const result = DisclosureSchema.safeParse({
        assessmentId: validUUID,
        framework,
        sectionKey: "test",
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid framework", () => {
    const result = DisclosureSchema.safeParse({
      assessmentId: validUUID,
      framework: "gri",
      sectionKey: "test",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty section key", () => {
    const result = DisclosureSchema.safeParse({
      assessmentId: validUUID,
      framework: "tnfd",
      sectionKey: "",
    });
    expect(result.success).toBe(false);
  });
});

// ── Monitoring Rule Schema ──────────────────────────────

const MonitoringRuleSchema = z.object({
  targetType: z.enum(["site", "organization", "material", "relationship"]),
  targetId: z.string().uuid(),
  ruleType: z.enum([
    "source_refresh",
    "threshold",
    "missing_evidence",
    "review_due",
  ]),
  config: z.record(z.string(), z.unknown()).default({}),
});

describe("MonitoringRuleSchema", () => {
  const validUUID = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts valid monitoring rule", () => {
    const result = MonitoringRuleSchema.safeParse({
      targetType: "site",
      targetId: validUUID,
      ruleType: "threshold",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.config).toEqual({}); // default
    }
  });

  it("accepts all target types", () => {
    for (const tt of ["site", "organization", "material", "relationship"]) {
      const result = MonitoringRuleSchema.safeParse({
        targetType: tt,
        targetId: validUUID,
        ruleType: "threshold",
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts all rule types", () => {
    for (const rt of [
      "source_refresh",
      "threshold",
      "missing_evidence",
      "review_due",
    ]) {
      const result = MonitoringRuleSchema.safeParse({
        targetType: "site",
        targetId: validUUID,
        ruleType: rt,
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts config with arbitrary keys", () => {
    const result = MonitoringRuleSchema.safeParse({
      targetType: "site",
      targetId: validUUID,
      ruleType: "threshold",
      config: { max_score: 75, check_interval_days: 7 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.config).toEqual({
        max_score: 75,
        check_interval_days: 7,
      });
    }
  });
});

// ── Data Source Schema ──────────────────────────────────

const DataSourceSchema = z.object({
  sourceKey: z
    .string()
    .min(1, "Source key is required")
    .regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers, underscores"),
  sourceName: z.string().min(1, "Source name is required"),
  category: z.enum([
    "protected_area",
    "kba",
    "water",
    "forest",
    "land_cover",
    "species",
    "climate",
    "custom",
  ]),
  licenseType: z.string().optional(),
  accessMode: z
    .enum(["manual", "api", "file", "customer_provided"])
    .default("manual"),
  vendorName: z.string().optional(),
});

describe("DataSourceSchema", () => {
  it("accepts valid data source", () => {
    const result = DataSourceSchema.safeParse({
      sourceKey: "wdpa_protected_areas",
      sourceName: "WDPA Protected Areas",
      category: "protected_area",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.accessMode).toBe("manual"); // default
    }
  });

  it("rejects source key with uppercase letters", () => {
    const result = DataSourceSchema.safeParse({
      sourceKey: "Bad_Key",
      sourceName: "Test",
      category: "water",
    });
    expect(result.success).toBe(false);
  });

  it("rejects source key with spaces", () => {
    const result = DataSourceSchema.safeParse({
      sourceKey: "bad key",
      sourceName: "Test",
      category: "water",
    });
    expect(result.success).toBe(false);
  });

  it("rejects source key with hyphens", () => {
    const result = DataSourceSchema.safeParse({
      sourceKey: "bad-key",
      sourceName: "Test",
      category: "water",
    });
    expect(result.success).toBe(false);
  });

  it("accepts source key with underscores and numbers", () => {
    const result = DataSourceSchema.safeParse({
      sourceKey: "gfw_alerts_v2",
      sourceName: "GFW Alerts",
      category: "forest",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all categories", () => {
    const categories = [
      "protected_area",
      "kba",
      "water",
      "forest",
      "land_cover",
      "species",
      "climate",
      "custom",
    ];
    for (const category of categories) {
      const result = DataSourceSchema.safeParse({
        sourceKey: "test_source",
        sourceName: "Test",
        category,
      });
      expect(result.success).toBe(true);
    }
  });
});
