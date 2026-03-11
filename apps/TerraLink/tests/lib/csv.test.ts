import { describe, it, expect } from "vitest";
import { parseCsv, validateHeaders, chunk } from "@/lib/csv";

// ── parseCsv ─────────────────────────────────────────────

describe("parseCsv", () => {
  it("parses basic CSV with headers and rows", () => {
    const input = "Name,Age,City\nAlice,30,Tokyo\nBob,25,Osaka";
    const result = parseCsv(input);
    expect(result.headers).toEqual(["name", "age", "city"]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ name: "Alice", age: "30", city: "Tokyo" });
    expect(result.rows[1]).toEqual({ name: "Bob", age: "25", city: "Osaka" });
  });

  it("normalizes header names to lowercase with underscores", () => {
    const input = "Legal Name,Display Name,Org Type\nFoo,Bar,buyer";
    const result = parseCsv(input);
    expect(result.headers).toEqual(["legal_name", "display_name", "org_type"]);
    expect(result.rows[0]).toEqual({
      legal_name: "Foo",
      display_name: "Bar",
      org_type: "buyer",
    });
  });

  it("handles quoted fields with commas inside", () => {
    const input = 'Name,Address\nAlice,"123 Main St, Suite 4"\nBob,"456 Oak Ave"';
    const result = parseCsv(input);
    expect(result.rows[0].address).toBe("123 Main St, Suite 4");
    expect(result.rows[1].address).toBe("456 Oak Ave");
  });

  it("handles escaped quotes (double-double quotes)", () => {
    const input = 'Name,Note\nAlice,"She said ""hello"""\nBob,Normal';
    const result = parseCsv(input);
    expect(result.rows[0].note).toBe('She said "hello"');
    expect(result.rows[1].note).toBe("Normal");
  });

  it("handles Windows line endings (\\r\\n)", () => {
    const input = "Name,Age\r\nAlice,30\r\nBob,25";
    const result = parseCsv(input);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ name: "Alice", age: "30" });
    expect(result.rows[1]).toEqual({ name: "Bob", age: "25" });
  });

  it("strips BOM markers", () => {
    const bom = "\uFEFF";
    const input = `${bom}Name,Age\nAlice,30`;
    const result = parseCsv(input);
    expect(result.headers).toEqual(["name", "age"]);
    expect(result.rows[0]).toEqual({ name: "Alice", age: "30" });
  });

  it("skips empty lines", () => {
    const input = "Name,Age\nAlice,30\n\n\nBob,25\n";
    const result = parseCsv(input);
    expect(result.rows).toHaveLength(2);
  });

  it("returns empty result for empty string", () => {
    expect(parseCsv("")).toEqual({ headers: [], rows: [] });
    expect(parseCsv("   ")).toEqual({ headers: [], rows: [] });
  });

  it("handles rows with fewer columns than headers", () => {
    const input = "A,B,C\n1";
    const result = parseCsv(input);
    expect(result.rows[0]).toEqual({ a: "1", b: "", c: "" });
  });

  it("handles rows with more columns than headers (extras ignored)", () => {
    const input = "A,B\n1,2,3,4";
    const result = parseCsv(input);
    // Only header columns are mapped
    expect(result.rows[0]).toEqual({ a: "1", b: "2" });
  });

  it("handles quoted fields containing newlines", () => {
    const input = 'Name,Address\nAlice,"123 Main St\nApt 4"\nBob,Simple';
    const result = parseCsv(input);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].address).toBe("123 Main St\nApt 4");
    expect(result.rows[1].address).toBe("Simple");
  });

  it("handles header-only CSV", () => {
    const input = "Name,Age,City";
    const result = parseCsv(input);
    expect(result.headers).toEqual(["name", "age", "city"]);
    expect(result.rows).toHaveLength(0);
  });

  it("trims whitespace from values", () => {
    const input = "Name, Age \n Alice , 30 ";
    const result = parseCsv(input);
    expect(result.headers).toEqual(["name", "age"]);
    expect(result.rows[0]).toEqual({ name: "Alice", age: "30" });
  });
});

// ── validateHeaders ──────────────────────────────────────

describe("validateHeaders", () => {
  it("returns empty array when all required headers present", () => {
    const headers = ["name", "age", "city"];
    const required = ["name", "age"];
    expect(validateHeaders(headers, required)).toEqual([]);
  });

  it("returns missing headers", () => {
    const headers = ["name", "city"];
    const required = ["name", "age", "email"];
    expect(validateHeaders(headers, required)).toEqual(["age", "email"]);
  });

  it("returns all required when no headers match", () => {
    expect(validateHeaders([], ["a", "b"])).toEqual(["a", "b"]);
  });

  it("handles empty required list", () => {
    expect(validateHeaders(["a", "b"], [])).toEqual([]);
  });
});

// ── chunk ────────────────────────────────────────────────

describe("chunk", () => {
  it("splits array into equal chunks", () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });

  it("handles last chunk with fewer elements", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("handles chunk size larger than array", () => {
    expect(chunk([1, 2], 10)).toEqual([[1, 2]]);
  });

  it("returns empty array for empty input", () => {
    expect(chunk([], 3)).toEqual([]);
  });

  it("handles chunk size of 1", () => {
    expect(chunk([1, 2, 3], 1)).toEqual([[1], [2], [3]]);
  });

  it("works with non-number types", () => {
    expect(chunk(["a", "b", "c"], 2)).toEqual([["a", "b"], ["c"]]);
  });
});
