// Asserts the data audit counts in docs/specs (Task 1 "Data audit", Task 3 "Mock data set-up").
// Run with `npm run audit:data`. Node 24 runs .ts files directly, so no extra tool is needed.
//
// It reads the raw JSON and does not use the app's mappers on purpose: it checks the specs
// against the data itself. The mapper tests then check the app against the specs.
// Each check prints ok or FAIL; any FAIL makes the script exit with code 1.

import Big from "big.js";
import task1 from "../data/task1-service-explorer.json" with { type: "json" };
import task3 from "../data/task3-booking.json" with { type: "json" };
// Type-only, so Node strips it when it runs the script.
import type { ApiCategory, ApiProvider, ApiService } from "../src/features/services/api-types";

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const passed = JSON.stringify(actual) === JSON.stringify(expected);
  if (!passed) failures += 1;
  const detail = passed
    ? ""
    : `  (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`;
  console.log(`${passed ? "ok  " : "FAIL"}  ${label}${detail}`);
}

function countBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

// ---------- Task 1 ----------
console.log("Task 1: service explorer");

// Read the JSON as the API types. On its own, TypeScript infers plain string where the API
// types list values ("package", "percent"), and in a file this large ESLint's type checker
// sees some nullable fields as never null (no-unnecessary-condition and
// sonarjs/different-types-comparison then report false errors). The cast is only safe
// because the "values match the API types" checks below hold.
const { categories, providers, services } = task1 as {
  categories: ApiCategory[];
  providers: ApiProvider[];
  services: ApiService[];
};
const subcategories = categories.flatMap((category) => category.children);

check("13 top-level categories", categories.length, 13);
check("21 subcategories", subcategories.length, 21);
check("67 providers", providers.length, 67);
check("3,200 services", services.length, 3200);

// The cast above claims these value sets; check them, so it stays true.
const serviceTypes = new Set(["package", "lab_test", "wellness", "service", "insurance"]);
const adjustmentTypes = new Set(["percent", "amount"]);
const wellnessOptions = services.flatMap((s) => s.wellnessPricing);
check(
  "values match the API types: service and category types",
  [...services, ...categories, ...subcategories].every((item) => serviceTypes.has(item.type)),
  true,
);
check(
  "values match the API types: currency is THB, NPR or INR",
  providers.every((p) => ["THB", "NPR", "INR"].includes(p.providerInformation.currency)),
  true,
);
check(
  "values match the API types: provider status is active or inactive",
  providers.every((p) => ["active", "inactive"].includes(p.status)),
  true,
);
check(
  "values match the API types: discount and charge types are percent, amount or null",
  [...services, ...wellnessOptions].every(
    (item) =>
      (item.discountType === null || adjustmentTypes.has(item.discountType)) &&
      (item.serviceChargeType === null || adjustmentTypes.has(item.serviceChargeType)),
  ),
  true,
);
check(
  "values match the API types: no wellness option field is null",
  wellnessOptions.every((option) => Object.values(option).every((value) => value !== null)),
  true,
);

// The visibility rule, written out again here on purpose (see the note at the top).
const categoryById = new Map([...categories, ...subcategories].map((c) => [c.id, c]));
const providerById = new Map(providers.map((p) => [p.id, p]));
const isVisible = (service: ApiService): boolean =>
  service.status &&
  providerById.get(service.userId)?.status === "active" &&
  (service.categoryId === null || categoryById.get(service.categoryId)?.status === true) &&
  (service.subCategoryId === null || categoryById.get(service.subCategoryId)?.status === true);

check("2,853 services visible", services.filter((s) => isVisible(s)).length, 2853);

const inactiveCategories = categories.filter((c) => !c.status);
check(
  "only Seasonal Offers is an inactive category",
  inactiveCategories.map((c) => c.title),
  ["Seasonal Offers"],
);
const seasonal = inactiveCategories[0];
const seasonalServices = seasonal ? services.filter((s) => s.categoryId === seasonal.id) : [];
check("Seasonal Offers holds 46 services", seasonalServices.length, 46);
check("no subcategory is inactive", subcategories.filter((c) => !c.status).length, 0);

const inactiveProviderIds = providers.filter((p) => p.status !== "active").map((p) => p.id);
check("providers 161 and 162 are inactive", inactiveProviderIds, [161, 162]);
check(
  "inactive providers hold 113 services",
  services.filter((s) => inactiveProviderIds.includes(s.userId)).length,
  113,
);
check("198 services have status false", services.filter((s) => !s.status).length, 198);

check(
  "every service points at a provider that exists",
  services.every((s) => providerById.has(s.userId)),
  true,
);
check(
  "every category and subcategory id on a service exists",
  services.every(
    (s) =>
      (s.categoryId === null || categoryById.has(s.categoryId)) &&
      (s.subCategoryId === null || categoryById.has(s.subCategoryId)),
  ),
  true,
);

// If either failed, a service would get a subcategory key under the wrong parent.
check(
  "every service's subcategory is a child of its category",
  services.every(
    (s) => s.subCategoryId === null || categoryById.get(s.subCategoryId)?.parentId === s.categoryId,
  ),
  true,
);
check(
  "every service has the same type as its category",
  services.every((s) => s.categoryId === null || categoryById.get(s.categoryId)?.type === s.type),
  true,
);

// Slugs repeat, which is why category keys include the type (and the parent for subcategories).
const repeatedTopSlugs = [...countBy(categories, (c) => c.slug)]
  .filter(([, group]) => group.length > 1)
  .map(([slug, group]) => `${slug}: ${group.map((c) => c.type).join(", ")}`);
check("slug ultrasound is shared by a package and a lab_test category", repeatedTopSlugs, [
  "ultrasound: package, lab_test",
]);
check(
  "subcategory slug thyroid appears 3 times",
  subcategories.filter((c) => c.slug === "thyroid").length,
  3,
);

const withoutCategory = services.filter((s) => s.categoryId === null);
check("22 services have no categoryId", withoutCategory.length, 22);
// The spec says all 22 stay visible under Other; 2 are hidden by the other rules (Decisions).
check(
  "20 of them are visible, under Other",
  withoutCategory.filter((s) => isVisible(s)).length,
  20,
);

const newProviders = providers.filter((p) => p.providerInformation.rating === null);
check(
  "providers 61, 105, 122, 139, 156 have rating null",
  newProviders.map((p) => p.id),
  [61, 105, 122, 139, 156],
);
check(
  "and 0 reviews each",
  newProviders.every((p) => p.providerInformation.reviewCount === 0),
  true,
);

// "Different prices" compares every pricing field, wellness options included but without their
// ids, which are unique and would make any two wellness listings look different.
// The price field alone repeats in 180 groups, almost all wellness, where it is null (Decisions).
const repeatedTitles = [
  ...countBy(services, (s) => `${String(s.userId)}|${s.title}`).values(),
].filter((group) => group.length > 1);
check("747 cases of one provider listing a title more than once", repeatedTitles.length, 747);
const pricingOf = (s: ApiService): string =>
  JSON.stringify([
    s.price,
    s.discount,
    s.discountType,
    s.serviceCharge,
    s.serviceChargeType,
    s.wellnessPricing.map((o) => [
      o.durationInMinutes,
      o.price,
      o.discount,
      o.discountType,
      o.serviceCharge,
      o.serviceChargeType,
    ]),
  ]);
check(
  "in 180 of them the price field alone repeats",
  repeatedTitles.filter((group) => new Set(group.map((s) => s.price)).size < group.length).length,
  180,
);
check(
  "none of them repeat the same pricing",
  repeatedTitles.filter((group) => new Set(group.map((s) => pricingOf(s))).size < group.length)
    .length,
  0,
);

// Edge cases 0001 to 0007: their ids end in 00000000 then the case number.
const edgeCase = (suffix: string): ApiService | undefined =>
  services.find((s) => s.id.endsWith(`00000000${suffix}`));
check(
  "0001 is 6200, 10% off, 7% service charge",
  [
    edgeCase("0001")?.price,
    edgeCase("0001")?.discount,
    edgeCase("0001")?.discountType,
    edgeCase("0001")?.serviceCharge,
    edgeCase("0001")?.serviceChargeType,
  ],
  ["6200.00", "10.00", "percent", "7.00", "percent"],
);
check(
  "0002 is 3500 NPR with an amount discount of 500",
  [
    edgeCase("0002")?.price,
    edgeCase("0002")?.discount,
    edgeCase("0002")?.discountType,
    providerById.get(edgeCase("0002")?.userId ?? -1)?.providerInformation.currency,
  ],
  ["3500.00", "500.00", "amount", "NPR"],
);
check(
  "0003 is wellness with 60 and 90 minute options",
  edgeCase("0003")?.wellnessPricing.map((o) => o.durationInMinutes),
  [60, 90],
);
check("0004 has status false", edgeCase("0004")?.status, false);
check(
  "0005 has a discount of 600 on a price of 450",
  [edgeCase("0005")?.price, edgeCase("0005")?.discount],
  ["450.00", "600.00"],
);
check("0006 has price 0.00", edgeCase("0006")?.price, "0.00");
check("0007 has a title with stray spaces", edgeCase("0007")?.title, "  hba1c   TEST (Diabetes) ");

// A discount larger than the price is a provider mistake (spec rule behind 0005).
const discountTooBig = (
  price: string | null,
  discount: string | null,
  type: string | null,
): boolean =>
  price !== null && discount !== null && type === "amount" && new Big(discount).gt(price);
check(
  "0005 is the only service with an amount discount larger than its price",
  services
    .filter((s) => discountTooBig(s.price, s.discount, s.discountType))
    .map((s) => s.id.slice(-4)),
  ["0005"],
);
check(
  "no wellness option has a discount larger than its price",
  services
    .flatMap((s) => s.wellnessPricing)
    .filter((o) => discountTooBig(o.price, o.discount, o.discountType)).length,
  0,
);
check(
  "no percent discount is over 100",
  services.filter((s) => s.discountType === "percent" && new Big(s.discount ?? "0").gt(100)).length,
  0,
);

// ---------- Task 3 ----------
console.log("\nTask 3: booking");

const { bookedSlots, existingBooking } = task3;
const specialistById = new Map(
  task3.providers.flatMap((p) => p.specialists.map((s) => [s.id, { ...s, providerId: p.id }])),
);
const minutesOf = (time: string): number => {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

check("613 booked slots", bookedSlots.length, 613);
const offsets = bookedSlots.map((slot) => slot.dayOffset);
check(
  "booked slots run from day 0 to day 29",
  [Math.min(...offsets), Math.max(...offsets)],
  [0, 29],
);

// On the grid: starts at consultation start plus a whole number of (duration + buffer) steps,
// and ends by consultation end, for a specialist of that provider.
const offGrid = bookedSlots.filter((slot) => {
  const specialist = specialistById.get(slot.specialistId);
  if (specialist?.providerId !== slot.providerId) return true;
  const { startTime, endTime, durationInMinutes, bufferInMinutes } = specialist.consultation;
  const sinceStart = minutesOf(slot.startTime) - minutesOf(startTime);
  return (
    sinceStart < 0 ||
    sinceStart % (durationInMinutes + bufferInMinutes) !== 0 ||
    minutesOf(slot.startTime) + durationInMinutes > minutesOf(endTime)
  );
});
check("every booked slot is on its specialist's grid", offGrid.length, 0);

const bookedKeys = bookedSlots.map(
  (s) => `${s.specialistId}|${String(s.dayOffset)}|${s.startTime}`,
);
check("no slot is booked twice", bookedKeys.length - new Set(bookedKeys).size, 0);

check(
  "existingBooking is BK-20261008-0042, provider 48, day 3, 11:20, 1 person",
  [
    existingBooking.bookingId,
    existingBooking.providerId,
    existingBooking.dayOffset,
    existingBooking.startTime,
    existingBooking.numberOfPeople,
  ],
  ["BK-20261008-0042", 48, 3, "11:20", 1],
);
check(
  "existingBooking is with Dr. A. Wongsakul",
  specialistById.get(existingBooking.specialistId)?.name,
  "Dr. A. Wongsakul",
);
check(
  "existingBooking's slot is not in bookedSlots",
  bookedKeys.includes(
    `${existingBooking.specialistId}|${String(existingBooking.dayOffset)}|${existingBooking.startTime}`,
  ),
  false,
);

console.log(failures === 0 ? "\nAll checks passed." : `\n${String(failures)} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;
