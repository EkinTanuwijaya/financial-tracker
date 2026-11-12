import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { currentMonth, overviewPeriod } from "./overview";

describe("overview period filters", () => {
  it("includes the entire September receipt month", () => {
    const range = overviewPeriod("2026-09", false);
    assert.equal(range.label, "September 2026");
    assert.deepEqual(range.params, {
      startDate: "2026-09-01T00:00:00.000Z",
      endDate: "2026-09-30T23:59:59.999Z",
    });
    assert.ok(
      new Date("2026-09-06T00:00:00Z") >= new Date(range.params.startDate),
    );
    assert.ok(
      new Date("2026-09-30T23:59:59.999Z") <= new Date(range.params.endDate),
    );
  });

  it("includes leap days and handles December rollover", () => {
    assert.equal(
      overviewPeriod("2028-02", false).params.endDate,
      "2028-02-29T23:59:59.999Z",
    );
    assert.equal(
      overviewPeriod("2026-12", false).params.endDate,
      "2026-12-31T23:59:59.999Z",
    );
  });

  it("removes date restrictions for all-time totals", () => {
    assert.deepEqual(overviewPeriod("2026-11", true), {
      label: "All time",
      params: {},
    });
  });

  for (const month of ["", "2026-00", "2026-13", "2026-9", "invalid"]) {
    it(`rejects invalid month ${month}`, () => {
      assert.throws(() => overviewPeriod(month, false), /Choose a valid month/);
    });
  }

  it("uses the browser's calendar month without converting to UTC", () => {
    assert.equal(currentMonth(new Date(2026, 8, 1, 0, 15)), "2026-09");
  });
});
