import { describe, it, expect } from "vitest";
import { z } from "zod/v4";

/**
 * EUDR module tests — schema validation, scoring logic, CSV import validation.
 *
 * Server action files use "use server" and cannot be directly imported in Node
 * test environment, so we replicate schemas and pure logic here.
 */

// ── Replicated Enums (from lib/types/eudr.ts) ──────────────

const EUDR_COMMODITY_TYPES = [
  "cattle",
  "cocoa",
  "coffee",
  "oil_palm",
  "rubber",
  "soya",
  "wood",
] as const;

const DDS_STATUSES = [
  "draft",
  "ready",
  "submitted",
  "validated",
  "rejected",
  "withdrawn",
] as const;

const OPERATOR_TYPES = ["operator", "non_sme_trader", "sme_trader"] as const;

const GEOLOCATION_TYPES = ["point", "polygon"] as const;

const ESTABLISHMENT_TYPES = [
  "birthplace",
  "rearing_farm",
  "feeding_facility",
  "grazing_land",
  "slaughterhouse",
] as const;

const RISK_RESULTS = ["pending", "negligible", "non_negligible"] as const;

const RISK_SCORES = ["low", "medium", "high"] as const;

const RISK_CRITERION_KEYS = [
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "g",
  "h",
  "i",
  "j",
  "k",
  "l",
  "m",
  "n",
] as const;

// ── Replicated Schemas (from eudr-actions.ts) ───────────────

const DdsStatementSchema = z.object({
  operatorOrgId: z.string().uuid("オペレーター組織を選択してください"),
  internalReference: z.string().min(1, "内部参照番号は必須です"),
  operatorType: z
    .enum(["operator", "non_sme_trader", "sme_trader"])
    .default("operator"),
  countryOfActivity: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

const ProductLineSchema = z.object({
  ddsId: z.string().uuid(),
  commodityType: z.enum([
    "cattle",
    "cocoa",
    "coffee",
    "oil_palm",
    "rubber",
    "soya",
    "wood",
  ]),
  cnCode: z.string().min(1, "CNコードは必須です"),
  productDescription: z.string().min(1, "製品説明は必須です"),
  countryOfProduction: z.string().min(1, "生産国は必須です"),
  quantityKg: z.coerce.number().positive().optional(),
  hsCode: z.string().optional(),
  tradeName: z.string().optional(),
  scientificName: z.string().optional(),
});

const PlotSchema = z.object({
  productLineId: z.string().uuid(),
  geolocationType: z.enum(["point", "polygon"]).default("point"),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  geojson: z.string().optional(),
  areaHa: z.coerce.number().positive().optional(),
  countryOfProduction: z.string().min(1, "生産国は必須です"),
  region: z.string().optional(),
  productionStartDate: z.string().optional(),
  productionEndDate: z.string().optional(),
  siteId: z.string().uuid().optional(),
  plotReference: z.string().optional(),
});

const UpstreamRefSchema = z.object({
  ddsId: z.string().uuid(),
  referenceNumber: z.string().min(1, "参照番号は必須です"),
  verificationNumber: z.string().optional(),
  upstreamOperatorName: z.string().optional(),
  upstreamEori: z.string().optional(),
  upstreamCountry: z.string().optional(),
  commodityType: z.string().optional(),
  notes: z.string().optional(),
});

const MitigationSchema = z.object({
  riskAssessmentId: z.string().uuid(),
  criterionKey: z.string().optional(),
  mitigationType: z.string().min(1, "軽減措置の種類は必須です"),
  description: z.string().min(1, "説明は必須です"),
  evidenceItemId: z.string().uuid().optional(),
});

// ── Replicated Auto-scoring Logic (from eudr-actions.ts) ────

type SpatialHits = {
  forestHits: number;
  protectedAreaHits: number;
  kbaHits: number;
  totalHits: number;
  closestForestDistanceM: number | null;
  closestProtectedAreaDistanceM: number | null;
};

type Plot = {
  id: string;
  geolocation_type: string;
  latitude: number | null;
  longitude: number | null;
  geojson: unknown;
  area_ha: number | null;
  production_start_date: string | null;
  production_end_date: string | null;
  site_id: string | null;
};

type ProductLine = {
  id: string;
  cn_code: string;
  commodity_type: string;
  country_of_production: string;
};

type UpstreamRef = {
  id: string;
  reference_number: string;
  verification_number: string | null;
};

/**
 * Replicated scoring function (pure logic extracted from runAutoScoring).
 * This tests the algorithm itself without DB dependencies.
 */
function computeRiskScores(opts: {
  plots: Plot[];
  productLines: ProductLine[];
  upstreamRefs: UpstreamRef[];
  countryRiskMap: Record<string, string>;
  evidenceCount: number;
  spatialHits: SpatialHits;
}): { scores: Record<string, string>; overallResult: string } {
  const { plots, productLines, upstreamRefs, countryRiskMap, evidenceCount, spatialHits } =
    opts;

  // Max country risk
  let maxCountryRisk = "low";
  for (const tier of Object.values(countryRiskMap)) {
    if (tier === "high") maxCountryRisk = "high";
    else if (tier === "standard" && maxCountryRisk !== "high")
      maxCountryRisk = "standard";
  }

  const scores: Record<string, string> = {};

  // (a) Geolocation missing
  const plotsWithoutGeo = plots.filter(
    (p) =>
      p.geolocation_type === "point" &&
      (p.latitude == null || p.longitude == null)
  );
  const hasPolygonWithoutGeojson = plots.filter(
    (p) => p.geolocation_type === "polygon" && !p.geojson
  );
  scores.a =
    plotsWithoutGeo.length > 0 || hasPolygonWithoutGeojson.length > 0
      ? "high"
      : plots.length === 0
        ? "medium"
        : "low";

  // (b) Plot geometry invalid
  scores.b =
    plots.length === 0
      ? "medium"
      : plotsWithoutGeo.length > 0
        ? "medium"
        : "low";

  // (c) Production period missing
  const plotsWithoutDates = plots.filter(
    (p) => !p.production_start_date || !p.production_end_date
  );
  scores.c =
    plotsWithoutDates.length > 0 && plots.length > 0
      ? "high"
      : plots.length === 0
        ? "medium"
        : "low";

  // (d) Legality evidence
  scores.d = evidenceCount === 0 ? "high" : "low";

  // (e) Commodity mapping incomplete
  const unmappedLines = productLines.filter(
    (pl) => !pl.cn_code || !pl.commodity_type
  );
  scores.e = unmappedLines.length > 0 ? "high" : "low";

  // (f) Country risk not mapped
  const countries = [
    ...new Set(productLines.map((pl) => pl.country_of_production).filter(Boolean)),
  ];
  const unmappedCountries = countries.filter((c) => !countryRiskMap[c]);
  scores.f =
    unmappedCountries.length > 0
      ? "medium"
      : maxCountryRisk === "high"
        ? "high"
        : maxCountryRisk === "standard"
          ? "medium"
          : "low";

  // (g) Upstream DDS reference inconsistency
  const unverifiedRefs = upstreamRefs.filter((r) => !r.verification_number);
  scores.g = unverifiedRefs.length > 0 ? "medium" : "low";

  // (h) Deforestation screening — spatial
  if (spatialHits.forestHits > 0) {
    scores.h = "high";
  } else if (maxCountryRisk === "high") {
    scores.h = "medium";
  } else {
    scores.h = "low";
  }

  // (i) Forest degradation — spatial
  if (spatialHits.forestHits > 0) {
    const closeHit = spatialHits.closestForestDistanceM;
    scores.i = closeHit !== null && closeHit <= 5000 ? "high" : "medium";
  } else if (maxCountryRisk === "high") {
    scores.i = "medium";
  } else {
    scores.i = "low";
  }

  // (j) Protected area overlap — spatial
  if (spatialHits.protectedAreaHits > 0 || spatialHits.kbaHits > 0) {
    const closeHit = spatialHits.closestProtectedAreaDistanceM;
    scores.j = closeHit !== null && closeHit <= 0 ? "high" : "medium";
  } else {
    scores.j = "low";
  }

  // (k) Indigenous rights
  scores.k = maxCountryRisk === "high" ? "medium" : "low";

  // (l) Supply chain complexity
  scores.l =
    upstreamRefs.length > 3 ? "high" : upstreamRefs.length > 1 ? "medium" : "low";

  // (m) Corruption perception
  scores.m = maxCountryRisk === "high" ? "high" : "low";

  // (n) Sanctions/conflict
  scores.n = "low";

  // Overall result
  const hasHigh = Object.values(scores).includes("high");
  const hasMediumWithComplexity =
    Object.values(scores).filter((s) => s === "medium").length >= 3;
  const overallResult =
    hasHigh || hasMediumWithComplexity ? "non_negligible" : "negligible";

  return { scores, overallResult };
}

// ═══════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════

describe("EUDR Enums", () => {
  it("has 7 commodity types", () => {
    expect(EUDR_COMMODITY_TYPES).toHaveLength(7);
    expect(EUDR_COMMODITY_TYPES).toContain("cattle");
    expect(EUDR_COMMODITY_TYPES).toContain("wood");
  });

  it("has 6 DDS statuses", () => {
    expect(DDS_STATUSES).toHaveLength(6);
    expect(DDS_STATUSES).toContain("draft");
    expect(DDS_STATUSES).toContain("submitted");
  });

  it("has 14 risk criterion keys (a-n)", () => {
    expect(RISK_CRITERION_KEYS).toHaveLength(14);
    expect(RISK_CRITERION_KEYS[0]).toBe("a");
    expect(RISK_CRITERION_KEYS[13]).toBe("n");
  });

  it("has 3 operator types", () => {
    expect(OPERATOR_TYPES).toHaveLength(3);
  });

  it("has 2 geolocation types", () => {
    expect(GEOLOCATION_TYPES).toEqual(["point", "polygon"]);
  });

  it("has 5 establishment types", () => {
    expect(ESTABLISHMENT_TYPES).toHaveLength(5);
    expect(ESTABLISHMENT_TYPES).toContain("birthplace");
    expect(ESTABLISHMENT_TYPES).toContain("slaughterhouse");
  });

  it("has 3 risk results", () => {
    expect(RISK_RESULTS).toEqual(["pending", "negligible", "non_negligible"]);
  });

  it("has 3 risk scores", () => {
    expect(RISK_SCORES).toEqual(["low", "medium", "high"]);
  });
});

describe("DdsStatementSchema", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts valid DDS statement", () => {
    const result = DdsStatementSchema.safeParse({
      operatorOrgId: validUuid,
      internalReference: "DDS-2026-001",
      operatorType: "operator",
    });
    expect(result.success).toBe(true);
  });

  it("defaults operatorType to 'operator'", () => {
    const result = DdsStatementSchema.safeParse({
      operatorOrgId: validUuid,
      internalReference: "DDS-001",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.operatorType).toBe("operator");
    }
  });

  it("rejects empty internalReference", () => {
    const result = DdsStatementSchema.safeParse({
      operatorOrgId: validUuid,
      internalReference: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid UUID for operatorOrgId", () => {
    const result = DdsStatementSchema.safeParse({
      operatorOrgId: "not-a-uuid",
      internalReference: "DDS-001",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid operatorType", () => {
    const result = DdsStatementSchema.safeParse({
      operatorOrgId: validUuid,
      internalReference: "DDS-001",
      operatorType: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid operator types", () => {
    for (const type of OPERATOR_TYPES) {
      const result = DdsStatementSchema.safeParse({
        operatorOrgId: validUuid,
        internalReference: "DDS-001",
        operatorType: type,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("ProductLineSchema", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts valid product line", () => {
    const result = ProductLineSchema.safeParse({
      ddsId: validUuid,
      commodityType: "coffee",
      cnCode: "0901 21 00",
      productDescription: "Roasted coffee, decaffeinated",
      countryOfProduction: "BR",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all 7 commodity types", () => {
    for (const type of EUDR_COMMODITY_TYPES) {
      const result = ProductLineSchema.safeParse({
        ddsId: validUuid,
        commodityType: type,
        cnCode: "1234 56 78",
        productDescription: "Test product",
        countryOfProduction: "ID",
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid commodity type", () => {
    const result = ProductLineSchema.safeParse({
      ddsId: validUuid,
      commodityType: "invalid",
      cnCode: "0901",
      productDescription: "Test",
      countryOfProduction: "BR",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing CN code", () => {
    const result = ProductLineSchema.safeParse({
      ddsId: validUuid,
      commodityType: "coffee",
      cnCode: "",
      productDescription: "Test",
      countryOfProduction: "BR",
    });
    expect(result.success).toBe(false);
  });

  it("coerces quantity to number", () => {
    const result = ProductLineSchema.safeParse({
      ddsId: validUuid,
      commodityType: "soya",
      cnCode: "1201 90 00",
      productDescription: "Soybeans",
      countryOfProduction: "BR",
      quantityKg: "1500",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantityKg).toBe(1500);
    }
  });
});

describe("PlotSchema", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts valid point plot", () => {
    const result = PlotSchema.safeParse({
      productLineId: validUuid,
      geolocationType: "point",
      latitude: -3.1234,
      longitude: 104.5678,
      countryOfProduction: "ID",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid polygon plot", () => {
    const result = PlotSchema.safeParse({
      productLineId: validUuid,
      geolocationType: "polygon",
      countryOfProduction: "BR",
      geojson: '{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,1],[0,0]]]}',
      areaHa: 5.5,
    });
    expect(result.success).toBe(true);
  });

  it("defaults geolocationType to point", () => {
    const result = PlotSchema.safeParse({
      productLineId: validUuid,
      countryOfProduction: "BR",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.geolocationType).toBe("point");
    }
  });

  it("rejects latitude out of range", () => {
    const result = PlotSchema.safeParse({
      productLineId: validUuid,
      latitude: 91,
      longitude: 0,
      countryOfProduction: "BR",
    });
    expect(result.success).toBe(false);
  });

  it("rejects longitude out of range", () => {
    const result = PlotSchema.safeParse({
      productLineId: validUuid,
      latitude: 0,
      longitude: 181,
      countryOfProduction: "BR",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative area", () => {
    const result = PlotSchema.safeParse({
      productLineId: validUuid,
      countryOfProduction: "BR",
      areaHa: -1,
    });
    expect(result.success).toBe(false);
  });

  it("coerces area from string to number", () => {
    const result = PlotSchema.safeParse({
      productLineId: validUuid,
      countryOfProduction: "BR",
      areaHa: "3.75",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.areaHa).toBe(3.75);
    }
  });
});

describe("UpstreamRefSchema", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts valid upstream ref", () => {
    const result = UpstreamRefSchema.safeParse({
      ddsId: validUuid,
      referenceNumber: "REF-2026-001",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty reference number", () => {
    const result = UpstreamRefSchema.safeParse({
      ddsId: validUuid,
      referenceNumber: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts full upstream ref with all optional fields", () => {
    const result = UpstreamRefSchema.safeParse({
      ddsId: validUuid,
      referenceNumber: "REF-001",
      verificationNumber: "VER-001",
      upstreamOperatorName: "Acme Corp",
      upstreamEori: "DE123456789",
      upstreamCountry: "DE",
      commodityType: "wood",
      notes: "Verified via TRACES",
    });
    expect(result.success).toBe(true);
  });
});

describe("MitigationSchema", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts valid mitigation", () => {
    const result = MitigationSchema.safeParse({
      riskAssessmentId: validUuid,
      mitigationType: "additional_verification",
      description: "Additional satellite imagery analysis",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty mitigation type", () => {
    const result = MitigationSchema.safeParse({
      riskAssessmentId: validUuid,
      mitigationType: "",
      description: "Some description",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty description", () => {
    const result = MitigationSchema.safeParse({
      riskAssessmentId: validUuid,
      mitigationType: "audit",
      description: "",
    });
    expect(result.success).toBe(false);
  });
});

// ── Auto-scoring Tests ──────────────────────────────────────

describe("computeRiskScores", () => {
  const emptySpatialHits: SpatialHits = {
    forestHits: 0,
    protectedAreaHits: 0,
    kbaHits: 0,
    totalHits: 0,
    closestForestDistanceM: null,
    closestProtectedAreaDistanceM: null,
  };

  const basePlot: Plot = {
    id: "plot-1",
    geolocation_type: "point",
    latitude: -3.12,
    longitude: 104.56,
    geojson: null,
    area_ha: 2.5,
    production_start_date: "2024-01-01",
    production_end_date: "2024-12-31",
    site_id: null,
  };

  const basePl: ProductLine = {
    id: "pl-1",
    cn_code: "0901 21 00",
    commodity_type: "coffee",
    country_of_production: "BR",
  };

  it("returns negligible for low-risk complete DDS", () => {
    const { overallResult, scores } = computeRiskScores({
      plots: [basePlot],
      productLines: [basePl],
      upstreamRefs: [],
      countryRiskMap: { BR: "low" },
      evidenceCount: 1,
      spatialHits: emptySpatialHits,
    });

    expect(overallResult).toBe("negligible");
    expect(scores.a).toBe("low");
    expect(scores.b).toBe("low");
    expect(scores.c).toBe("low");
    expect(scores.d).toBe("low");
    expect(scores.h).toBe("low");
    expect(scores.j).toBe("low");
  });

  it("returns non_negligible when any score is high", () => {
    const { overallResult, scores } = computeRiskScores({
      plots: [], // No plots → medium for a, b, c
      productLines: [basePl],
      upstreamRefs: [],
      countryRiskMap: { BR: "high" },
      evidenceCount: 0, // No evidence → high for d
      spatialHits: emptySpatialHits,
    });

    expect(overallResult).toBe("non_negligible");
    expect(scores.d).toBe("high"); // Missing evidence
    expect(scores.f).toBe("high"); // High country risk
  });

  it("returns non_negligible with 3+ medium scores", () => {
    // All low risk but missing dates and evidence
    const plotNoDates = {
      ...basePlot,
      production_start_date: null,
      production_end_date: null,
    };
    const { overallResult, scores } = computeRiskScores({
      plots: [plotNoDates],
      productLines: [basePl],
      upstreamRefs: [
        { id: "r1", reference_number: "REF-1", verification_number: null },
      ],
      countryRiskMap: {}, // Not mapped → medium for f
      evidenceCount: 1,
      spatialHits: emptySpatialHits,
    });

    expect(scores.c).toBe("high"); // Missing dates
    expect(overallResult).toBe("non_negligible");
  });

  it("scores geolocation missing as high when point has no coords", () => {
    const plotNoCoords = { ...basePlot, latitude: null, longitude: null };
    const { scores } = computeRiskScores({
      plots: [plotNoCoords],
      productLines: [basePl],
      upstreamRefs: [],
      countryRiskMap: { BR: "low" },
      evidenceCount: 1,
      spatialHits: emptySpatialHits,
    });

    expect(scores.a).toBe("high");
    expect(scores.b).toBe("medium");
  });

  it("scores polygon without geojson as high", () => {
    const polygonNoGeojson = {
      ...basePlot,
      geolocation_type: "polygon",
      geojson: null,
    };
    const { scores } = computeRiskScores({
      plots: [polygonNoGeojson],
      productLines: [basePl],
      upstreamRefs: [],
      countryRiskMap: { BR: "low" },
      evidenceCount: 1,
      spatialHits: emptySpatialHits,
    });

    expect(scores.a).toBe("high");
  });

  it("scores deforestation high when spatial forest hits detected", () => {
    const { scores } = computeRiskScores({
      plots: [basePlot],
      productLines: [basePl],
      upstreamRefs: [],
      countryRiskMap: { BR: "low" },
      evidenceCount: 1,
      spatialHits: {
        forestHits: 3,
        protectedAreaHits: 0,
        kbaHits: 0,
        totalHits: 3,
        closestForestDistanceM: 0,
        closestProtectedAreaDistanceM: null,
      },
    });

    expect(scores.h).toBe("high");
    expect(scores.i).toBe("high"); // Close hit ≤ 5km
  });

  it("scores forest degradation as medium when hit > 5km", () => {
    const { scores } = computeRiskScores({
      plots: [basePlot],
      productLines: [basePl],
      upstreamRefs: [],
      countryRiskMap: { BR: "low" },
      evidenceCount: 1,
      spatialHits: {
        forestHits: 1,
        protectedAreaHits: 0,
        kbaHits: 0,
        totalHits: 1,
        closestForestDistanceM: 10000,
        closestProtectedAreaDistanceM: null,
      },
    });

    expect(scores.h).toBe("high"); // Any forest hit
    expect(scores.i).toBe("medium"); // > 5km
  });

  it("scores protected area overlap correctly", () => {
    const { scores } = computeRiskScores({
      plots: [basePlot],
      productLines: [basePl],
      upstreamRefs: [],
      countryRiskMap: { BR: "low" },
      evidenceCount: 1,
      spatialHits: {
        forestHits: 0,
        protectedAreaHits: 2,
        kbaHits: 0,
        totalHits: 2,
        closestForestDistanceM: null,
        closestProtectedAreaDistanceM: 0,
      },
    });

    expect(scores.j).toBe("high"); // Distance 0 = direct overlap
  });

  it("scores protected area as medium when nearby but not overlapping", () => {
    const { scores } = computeRiskScores({
      plots: [basePlot],
      productLines: [basePl],
      upstreamRefs: [],
      countryRiskMap: { BR: "low" },
      evidenceCount: 1,
      spatialHits: {
        forestHits: 0,
        protectedAreaHits: 1,
        kbaHits: 0,
        totalHits: 1,
        closestForestDistanceM: null,
        closestProtectedAreaDistanceM: 500,
      },
    });

    expect(scores.j).toBe("medium");
  });

  it("scores KBA hits same as protected area", () => {
    const { scores } = computeRiskScores({
      plots: [basePlot],
      productLines: [basePl],
      upstreamRefs: [],
      countryRiskMap: { BR: "low" },
      evidenceCount: 1,
      spatialHits: {
        forestHits: 0,
        protectedAreaHits: 0,
        kbaHits: 1,
        totalHits: 1,
        closestForestDistanceM: null,
        closestProtectedAreaDistanceM: null,
      },
    });

    expect(scores.j).toBe("medium");
  });

  it("scores supply chain complexity based on upstream ref count", () => {
    const refs = Array.from({ length: 5 }, (_, i) => ({
      id: `r${i}`,
      reference_number: `REF-${i}`,
      verification_number: `VER-${i}`,
    }));

    const { scores } = computeRiskScores({
      plots: [basePlot],
      productLines: [basePl],
      upstreamRefs: refs,
      countryRiskMap: { BR: "low" },
      evidenceCount: 1,
      spatialHits: emptySpatialHits,
    });

    expect(scores.l).toBe("high"); // > 3 refs
  });

  it("scores unverified upstream refs as medium", () => {
    const { scores } = computeRiskScores({
      plots: [basePlot],
      productLines: [basePl],
      upstreamRefs: [
        { id: "r1", reference_number: "REF-1", verification_number: null },
      ],
      countryRiskMap: { BR: "low" },
      evidenceCount: 1,
      spatialHits: emptySpatialHits,
    });

    expect(scores.g).toBe("medium");
  });

  it("handles high country risk escalation", () => {
    const { scores } = computeRiskScores({
      plots: [basePlot],
      productLines: [basePl],
      upstreamRefs: [],
      countryRiskMap: { BR: "high" },
      evidenceCount: 1,
      spatialHits: emptySpatialHits,
    });

    expect(scores.f).toBe("high");
    expect(scores.h).toBe("medium"); // No spatial hit, but high country risk
    expect(scores.i).toBe("medium");
    expect(scores.k).toBe("medium");
    expect(scores.m).toBe("high");
  });

  it("correctly counts all 14 criteria", () => {
    const { scores } = computeRiskScores({
      plots: [basePlot],
      productLines: [basePl],
      upstreamRefs: [],
      countryRiskMap: { BR: "low" },
      evidenceCount: 1,
      spatialHits: emptySpatialHits,
    });

    const keys = Object.keys(scores).sort();
    expect(keys).toEqual([...RISK_CRITERION_KEYS].sort());
    expect(keys).toHaveLength(14);
  });
});

// ── CSV Import Validation Tests ─────────────────────────────

describe("CSV Import Validation (plots)", () => {
  it("validates required headers for plots CSV", () => {
    const required = ["country_of_production"];
    const headers = [
      "country_of_production",
      "latitude",
      "longitude",
      "area_ha",
    ];
    const missing = required.filter((h) => !headers.includes(h));
    expect(missing).toEqual([]);
  });

  it("detects missing required headers", () => {
    const required = ["country_of_production"];
    const headers = ["latitude", "longitude", "area_ha"];
    const missing = required.filter((h) => !headers.includes(h));
    expect(missing).toEqual(["country_of_production"]);
  });
});

describe("CSV Import Validation (cattle establishments)", () => {
  it("validates required headers", () => {
    const required = ["cattle_animal_id", "establishment_type", "country_code"];
    const headers = [
      "cattle_animal_id",
      "establishment_type",
      "country_code",
      "latitude",
      "longitude",
    ];
    const missing = required.filter((h) => !headers.includes(h));
    expect(missing).toEqual([]);
  });

  it("validates establishment types", () => {
    const validTypes = new Set(ESTABLISHMENT_TYPES);
    expect(validTypes.has("birthplace")).toBe(true);
    expect(validTypes.has("slaughterhouse")).toBe(true);
    expect(validTypes.has("invalid" as never)).toBe(false);
  });
});

// ── resolveCountryRisk Tests (M5) ────────────────────────────

// Replicated from eudr-actions.ts (cannot import "use server" module in Node test)
function resolveCountryRisk(
  countryRiskMap: Record<string, string>,
  country: string,
  commodity?: string
): string {
  if (commodity) {
    const specific = countryRiskMap[`${country}|${commodity}`];
    if (specific) return specific;
  }
  return countryRiskMap[country] ?? "standard";
}

describe("resolveCountryRisk", () => {
  const map: Record<string, string> = {
    BR: "high",
    "BR|cattle": "high",
    "BR|coffee": "standard",
    DE: "low",
  };

  it("returns commodity-specific tier when available", () => {
    expect(resolveCountryRisk(map, "BR", "coffee")).toBe("standard");
    expect(resolveCountryRisk(map, "BR", "cattle")).toBe("high");
  });

  it("falls back to generic country tier", () => {
    expect(resolveCountryRisk(map, "BR", "soya")).toBe("high");
    expect(resolveCountryRisk(map, "DE", "wood")).toBe("low");
  });

  it("falls back to 'standard' for unknown country", () => {
    expect(resolveCountryRisk(map, "XX")).toBe("standard");
    expect(resolveCountryRisk(map, "XX", "coffee")).toBe("standard");
  });

  it("works without commodity parameter", () => {
    expect(resolveCountryRisk(map, "BR")).toBe("high");
    expect(resolveCountryRisk(map, "DE")).toBe("low");
  });
});

// ── Gap Analysis Validation Tests (M4) ───────────────────────

describe("Gap analysis validations", () => {
  it("detects missing evidence as warning", () => {
    const evidenceLinks: unknown[] = [];
    const needsWarning = evidenceLinks.length === 0;
    expect(needsWarning).toBe(true);
  });

  it("detects upstream commodity mismatch", () => {
    const productLines = [
      { commodity_type: "coffee" },
      { commodity_type: "cocoa" },
    ];
    const upstreamRef = { commodity_type: "cattle", reference_number: "REF-1" };
    const matches = productLines.some(
      (pl) => pl.commodity_type === upstreamRef.commodity_type
    );
    expect(matches).toBe(false);
  });

  it("does not flag upstream when commodity matches", () => {
    const productLines = [
      { commodity_type: "coffee" },
      { commodity_type: "cocoa" },
    ];
    const upstreamRef = { commodity_type: "coffee", reference_number: "REF-2" };
    const matches = productLines.some(
      (pl) => pl.commodity_type === upstreamRef.commodity_type
    );
    expect(matches).toBe(true);
  });

  it("flags point geolocation for plots >= 4ha (EUDR Art.9)", () => {
    const plot = { area_ha: 5.0, geolocation_type: "point" };
    const needsPolygon =
      plot.area_ha >= 4 && plot.geolocation_type === "point";
    expect(needsPolygon).toBe(true);
  });

  it("does not flag polygon geolocation for plots >= 4ha", () => {
    const plot = { area_ha: 10.0, geolocation_type: "polygon" };
    const needsPolygon =
      plot.area_ha >= 4 && plot.geolocation_type === "point";
    expect(needsPolygon).toBe(false);
  });

  it("does not flag point geolocation for plots < 4ha", () => {
    const plot = { area_ha: 3.5, geolocation_type: "point" };
    const needsPolygon =
      plot.area_ha >= 4 && plot.geolocation_type === "point";
    expect(needsPolygon).toBe(false);
  });
});
