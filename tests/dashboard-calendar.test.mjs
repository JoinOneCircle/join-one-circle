import assert from "node:assert/strict";
import test from "node:test";
import { monthCells, pendingItems, schoolDateKey } from "../src/lib/dashboard-calendar.ts";
import { platformTranslations } from "../src/lib/platform-translations.ts";
import { isKnownUiTranslation, translateUi, uiTranslations } from "../src/lib/ui-translations.ts";
import { primaryNavigation, secondaryNavigation } from "../src/lib/platform-navigation.ts";

test("calendar starts Monday and positions October 2026 correctly", () => {
  const cells = monthCells(2026, 9);
  assert.deepEqual(cells.slice(0, 4), [null, null, null, "2026-10-01"]);
  assert.equal(cells.filter(Boolean).length, 31);
  assert.equal(cells.length % 7, 0);
});
test("calendar handles leap February and December to January", () => {
  assert.equal(monthCells(2028, 1).filter(Boolean).length, 29);
  assert.equal(monthCells(2027, 0).find(Boolean), "2027-01-01");
});
test("UK reminders retain the school day across DST and browser zones", () => {
  assert.equal(schoolDateKey("2026-07-05T23:30:00Z"), "2026-07-06");
  assert.equal(schoolDateKey("2026-12-05T23:30:00Z"), "2026-12-05");
});
test("completed and cancelled work is not shown as a next step", () => {
  const rows = ["open", "in_progress", "waiting", "complete", "cancelled"].map((status) => ({ status }));
  assert.deepEqual(pendingItems(rows).map((row) => row.status), ["open", "in_progress", "waiting"]);
});
test("all new interface copy is complete in Portuguese and Spanish", () => {
  assert.deepEqual(Object.keys(platformTranslations.pt).sort(), Object.keys(platformTranslations.es).sort());
  for (const source of Object.keys(platformTranslations.pt)) {
    assert.notEqual(translateUi("pt", source), source, source);
    assert.notEqual(translateUi("es", source), source, source);
    assert.equal(translateUi("en", source), source);
  }
});

test("switching languages retains the source and still detects changed copy", () => {
  for (const source of ["Overview", "Search children", "  Your school, at a glance  "]) {
    for (const language of ["en", "pt", "es"]) {
      const rendered = source.replace(source.trim(), translateUi(language, source.trim()));
      assert.equal(isKnownUiTranslation(source, rendered), true);
    }
    assert.equal(isKnownUiTranslation(source, "New interface copy"), false);
  }
});

test("new school navigation does not reintroduce the legacy SEND menu", () => {
  assert.deepEqual(primaryNavigation.school.map((item) => item.label), ["Overview", "Children", "Templates", "Learning plans", "Documents", "Calendar"]);
  assert.deepEqual(secondaryNavigation.school.map((item) => item.href), ["/parent-access", "/parent"]);
  assert.equal(new Set(primaryNavigation.school.map((item) => item.icon)).size, 6);
  assert.ok(primaryNavigation.school.slice(0, 4).some((item) => item.href === "/templates"), "Templates must remain visible in the four mobile shortcuts");
  const schoolLinks = [...primaryNavigation.school, ...secondaryNavigation.school].map((item) => item.href);
  assert.equal(new Set(schoolLinks).size, schoolLinks.length, "The promoted link must not be duplicated in More");
});

test("Spanish legacy and pilot interface use a consistent child-record vocabulary without translating record data", () => {
  assert.equal(translateUi("es", "Children"), "Menores");
  assert.equal(translateUi("es", "Child"), "Menor");
  assert.equal(translateUi("es", "Search children"), "Buscar menores");
  assert.equal(translateUi("es", "My children"), "Mis menores");
  assert.equal(translateUi("pt", "Child"), "Criança");
  assert.equal(translateUi("en", "Child"), "Child");
  for (const value of Object.values(uiTranslations.es)) assert.doesNotMatch(value, /\bniñ/iu);
  const authored = "Nombre ficticio escrito por el usuario";
  assert.equal(translateUi("es", authored), authored);
});
