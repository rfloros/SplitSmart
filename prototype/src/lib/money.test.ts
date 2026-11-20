import { describe, expect, it } from "vitest";
import { ValidationError, computeBalances, formatCents, parseAmountToCents, splitEqually } from "./money";

const sum = (xs: Iterable<number>) => [...xs].reduce((a, b) => a + b, 0);

describe("parseAmountToCents", () => {
  it.each([
    ["60", 6000],
    ["10.5", 1050],
    ["10.05", 1005],
    ["$1,234.56", 123456],
    ["0.01", 1],
    [12.34, 1234],
  ])("parses %s -> %d", (input, cents) => {
    expect(parseAmountToCents(input)).toBe(cents);
  });

  it.each(["0", "0.00", "-5", "-0.01", "abc", "", "  ", "10.005", "1e3", "12.3.4", "1000000.01"])(
    "rejects %j",
    (input) => {
      expect(() => parseAmountToCents(input)).toThrow(ValidationError);
    },
  );

  it("rejects non-string values", () => {
    expect(() => parseAmountToCents(null)).toThrow(ValidationError);
    expect(() => parseAmountToCents(NaN)).toThrow(ValidationError);
    expect(() => parseAmountToCents(-3)).toThrow(ValidationError);
  });
});

describe("splitEqually", () => {
  it("splits $60 three ways evenly", () => {
    expect([...splitEqually(6000, [1, 2, 3])]).toEqual([[1, 2000], [2, 2000], [3, 2000]]);
  });

  it("splits $10 three ways to the cent, remainder to lowest member IDs", () => {
    const shares = splitEqually(1000, [3, 1, 2]);
    expect([...shares]).toEqual([[1, 334], [2, 333], [3, 333]]);
    expect(sum(shares.values())).toBe(1000);
  });

  it("is deterministic regardless of input order", () => {
    expect([...splitEqually(1001, [9, 4, 7])]).toEqual([...splitEqually(1001, [4, 7, 9])]);
  });

  it("always sums to the total", () => {
    for (let total = 1; total <= 500; total++) {
      for (let n = 1; n <= 7; n++) {
        const ids = Array.from({ length: n }, (_, i) => i + 1);
        expect(sum(splitEqually(total, ids).values())).toBe(total);
      }
    }
  });

  it("rejects empty and duplicate participants", () => {
    expect(() => splitEqually(100, [])).toThrow(ValidationError);
    expect(() => splitEqually(100, [1, 1])).toThrow(ValidationError);
  });
});

describe("computeBalances", () => {
  const expense = (payerId: number, total: number, ids: number[]) => ({
    payerId,
    amountCents: total,
    shares: [...splitEqually(total, ids)].map(([memberId, shareCents]) => ({ memberId, shareCents })),
  });

  it("Alice pays $60 for Alice, Bob, Charlie", () => {
    const b = computeBalances([1, 2, 3], [expense(1, 6000, [1, 2, 3])]);
    expect([...b]).toEqual([[1, 4000], [2, -2000], [3, -2000]]);
  });

  it("accumulates multiple expenses and sums to zero", () => {
    const b = computeBalances(
      [1, 2, 3],
      [expense(1, 6000, [1, 2, 3]), expense(2, 3000, [2, 3]), expense(3, 1000, [1, 2, 3])],
    );
    // Alice: +6000-2000-334 = 3666; Bob: -2000+3000-1500-333 = -833; Charlie: -2000-1500+1000-333 = -2833
    expect([...b]).toEqual([[1, 3666], [2, -833], [3, -2833]]);
    expect(sum(b.values())).toBe(0);
  });

  it("payer who is not a participant is owed the full amount", () => {
    const b = computeBalances([1, 2], [expense(1, 1000, [2])]);
    expect([...b]).toEqual([[1, 1000], [2, -1000]]);
  });
});

describe("formatCents", () => {
  it("formats", () => {
    expect(formatCents(4000, { signed: true })).toBe("+$40.00");
    expect(formatCents(-2000)).toBe("-$20.00");
    expect(formatCents(334)).toBe("$3.34");
    expect(formatCents(0, { signed: true })).toBe("$0.00");
    expect(formatCents(123456789)).toBe("$1,234,567.89");
  });
});
