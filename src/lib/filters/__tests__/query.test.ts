import { describe, it, expect } from "vitest";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import type { SQL } from "drizzle-orm";
import {
  usOnlyCondition,
  maxAlcoholDrugsCondition,
  maxIntenseScenesCondition,
} from "../query";

/**
 * These tests exercise the SQL-fragment builders by rendering them through
 * the real SQLite dialect. We pin exact column references and operators
 * so a future refactor that accidentally drops the `original_language = 'en'`
 * half of the US-only gate (or confuses alcohol vs. intense columns)
 * fails here loudly.
 */

const dialect = new SQLiteSyncDialect();

function render(chunk: SQL): string {
  const { sql, params } = dialect.sqlToQuery(chunk);
  // Inline params so substring assertions work regardless of placeholder style.
  let i = 0;
  return sql.replace(/\?/g, () => {
    const v = params[i++];
    return typeof v === "string" ? `'${v}'` : String(v);
  });
}

describe("usOnlyCondition", () => {
  it("references both original_language and production_countries", () => {
    const sql = render(usOnlyCondition());
    expect(sql).toMatch(/original_language/);
    expect(sql).toMatch(/production_countries/);
  });

  it("restricts to English + US ISO code specifically", () => {
    const sql = render(usOnlyCondition());
    expect(sql).toMatch(/=\s*'en'/);
    expect(sql).toMatch(/LIKE\s*'%"US"%'/);
  });

  it("AND-combines the two halves so both must match", () => {
    const sql = render(usOnlyCondition());
    expect(sql).toMatch(/AND/);
  });
});

describe("maxAlcoholDrugsCondition", () => {
  it("references the alcohol_drugs_score column", () => {
    const sql = render(maxAlcoholDrugsCondition(2));
    expect(sql).toMatch(/alcohol_drugs_score/);
  });

  it("uses a <= comparison against the provided max", () => {
    const sql = render(maxAlcoholDrugsCondition(3));
    expect(sql).toMatch(/<=/);
  });

  it("does NOT accidentally reference the intense-scenes column", () => {
    const sql = render(maxAlcoholDrugsCondition(2));
    expect(sql).not.toMatch(/intense_scenes_score/);
  });
});

describe("maxIntenseScenesCondition", () => {
  it("references the intense_scenes_score column", () => {
    const sql = render(maxIntenseScenesCondition(2));
    expect(sql).toMatch(/intense_scenes_score/);
  });

  it("does NOT accidentally reference the alcohol_drugs column", () => {
    const sql = render(maxIntenseScenesCondition(2));
    expect(sql).not.toMatch(/alcohol_drugs_score/);
  });
});
