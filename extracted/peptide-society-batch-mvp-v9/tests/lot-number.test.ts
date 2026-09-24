import { describe, expect, it } from "vitest";
import { buildPsLotNumber, formatLotDate } from "../src/lib/lot-number";

describe("Peptide Society lot numbers", () => {
  it("formats UTC date as YYMMDD", () => {
    expect(formatLotDate(new Date("2026-09-17T12:00:00Z"))).toBe("260917");
  });

  it("builds the approved lot format", () => {
    expect(buildPsLotNumber("BPC", new Date("2026-09-17T12:00:00Z"), 1)).toBe("PS-BPC-260917-01");
  });

  it("normalizes lot codes", () => {
    expect(buildPsLotNumber("nad+", new Date("2026-09-17T12:00:00Z"), 12)).toBe("PS-NAD-260917-12");
  });
});
