import { describe, expect, it } from "vitest";
import { getCatalog, HERO_PRODUCT_DEFS } from "../src/data/catalog";

describe("catalog generator", () => {
  it("produces a deterministic, fixed-size catalog", () => {
    const a = getCatalog();
    const b = getCatalog();
    expect(a.totalProducts).toBe(15000);
    expect(a.totalStores).toBe(80);
    expect(a.products.map((p) => p.id)).toEqual(b.products.map((p) => p.id));
  });

  it("includes every hero product referenced by scenarios", () => {
    const catalog = getCatalog();
    for (const def of HERO_PRODUCT_DEFS) {
      expect(catalog.heroProducts[def.id]).toBeDefined();
      expect(catalog.heroProducts[def.id]?.name).toBe(def.name);
    }
  });

  it("assigns every store to one of the four Western Canada regions", () => {
    const catalog = getCatalog();
    const regions = new Set(catalog.stores.map((s) => s.region));
    expect(regions).toEqual(new Set(["BC", "AB", "SK", "MB"]));
  });
});
