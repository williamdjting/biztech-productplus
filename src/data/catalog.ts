// Deterministic catalog generator.
// Production note: this entire module would be replaced by reads against SAP IBP
// master data (product/location planning objects) via the IBP OData API.
import { mulberry32 } from "./rng";
import type { Product, Region, Store } from "../domain/types";

const CATALOG_SEED = 42;

export const CATEGORIES = [
  "Beverages",
  "Snacks",
  "Dairy",
  "Produce",
  "Bakery",
  "Frozen Foods",
  "Household & Cleaning",
  "Personal Care",
  "Health & Wellness",
  "Outdoor & Seasonal",
  "BBQ & Grilling",
  "Pet Supplies",
  "Baby Care",
  "Pantry Staples",
  "Electronics & Accessories",
] as const;

const CITIES_BY_REGION: Record<Region, { city: string; stores: number }[]> = {
  BC: [
    { city: "Vancouver", stores: 8 },
    { city: "Surrey", stores: 5 },
    { city: "Burnaby", stores: 4 },
    { city: "Richmond", stores: 3 },
    { city: "Kelowna", stores: 4 },
    { city: "Victoria", stores: 3 },
    { city: "Abbotsford", stores: 2 },
    { city: "Kamloops", stores: 2 },
    { city: "Nanaimo", stores: 1 },
  ],
  AB: [
    { city: "Calgary", stores: 9 },
    { city: "Edmonton", stores: 9 },
    { city: "Red Deer", stores: 3 },
    { city: "Lethbridge", stores: 3 },
    { city: "Fort McMurray", stores: 2 },
    { city: "Medicine Hat", stores: 2 },
  ],
  SK: [
    { city: "Saskatoon", stores: 5 },
    { city: "Regina", stores: 4 },
    { city: "Prince Albert", stores: 1 },
  ],
  MB: [
    { city: "Winnipeg", stores: 7 },
    { city: "Brandon", stores: 2 },
    { city: "Steinbach", stores: 1 },
  ],
};

/** Named products referenced directly by hero scenarios and classified signals. */
export const HERO_PRODUCT_DEFS: { id: string; name: string; category: string }[] = [
  { id: "hero-bottled-water-500", name: "Bottled Water 500mL (24pk)", category: "Beverages" },
  { id: "hero-bottled-water-alt", name: "Competing Spring Water Brand (24pk)", category: "Beverages" },
  { id: "hero-portable-fan", name: "Portable Fan", category: "Electronics & Accessories" },
  { id: "hero-sunscreen-spf50", name: "Sunscreen SPF50", category: "Personal Care" },
  { id: "hero-bbq-charcoal", name: "BBQ Charcoal 5kg", category: "BBQ & Grilling" },
  { id: "hero-cottage-cheese", name: "Cottage Cheese 500g", category: "Dairy" },
  { id: "hero-canned-beans", name: "Canned Beans (12pk)", category: "Pantry Staples" },
  { id: "hero-bread-loaf", name: "White Bread Loaf", category: "Bakery" },
  { id: "hero-snow-shovel", name: "Snow Shovel", category: "Outdoor & Seasonal" },
];

export interface Catalog {
  stores: Store[];
  categories: readonly string[];
  products: Product[];
  heroProducts: Record<string, Product>;
  totalProducts: number;
  totalStores: number;
}

function generateStores(): Store[] {
  const stores: Store[] = [];
  let counter = 1;
  (Object.keys(CITIES_BY_REGION) as Region[]).forEach((region) => {
    CITIES_BY_REGION[region].forEach(({ city, stores: count }) => {
      for (let i = 0; i < count; i++) {
        const id = `ST-${String(counter).padStart(3, "0")}`;
        stores.push({ id, name: `${city} #${i + 1}`, city, region });
        counter++;
      }
    });
  });
  return stores;
}

function generateProducts(rng: () => number): { products: Product[]; heroProducts: Record<string, Product> } {
  const heroProducts: Record<string, Product> = {};
  const products: Product[] = HERO_PRODUCT_DEFS.map((def) => {
    const product: Product = { id: def.id, name: def.name, category: def.category, isHero: true };
    heroProducts[def.id] = product;
    return product;
  });

  const TOTAL = 15000;
  const remaining = TOTAL - products.length;
  for (let i = 0; i < remaining; i++) {
    const category = CATEGORIES[Math.floor(rng() * CATEGORIES.length)];
    const id = `SKU-${String(i + 1).padStart(6, "0")}`;
    products.push({ id, name: `${category} Item ${i + 1}`, category });
  }
  return { products, heroProducts };
}

let cached: Catalog | null = null;

/** Deterministic across runs: same seed, same catalog, every time. */
export function getCatalog(): Catalog {
  if (cached) return cached;
  const rng = mulberry32(CATALOG_SEED);
  const stores = generateStores();
  const { products, heroProducts } = generateProducts(rng);
  cached = {
    stores,
    categories: CATEGORIES,
    products,
    heroProducts,
    totalProducts: products.length,
    totalStores: stores.length,
  };
  return cached;
}

export function storesInRegion(region: Region): Store[] {
  return getCatalog().stores.filter((s) => s.region === region);
}

export function storesInCities(cities: string[]): Store[] {
  return getCatalog().stores.filter((s) => cities.includes(s.city));
}

export function storeById(id: string): Store | undefined {
  return getCatalog().stores.find((s) => s.id === id);
}

export function productById(id: string): Product | undefined {
  const catalog = getCatalog();
  return catalog.heroProducts[id] ?? catalog.products.find((p) => p.id === id);
}
