/**
 * Money and balance rules for SplitSmart.
 * All amounts are integer cents; no floating-point arithmetic is used for money.
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Largest accepted single expense: $1,000,000.00. */
export const MAX_EXPENSE_CENTS = 100_000_000;

/**
 * Parses a user-entered dollar amount (e.g. "60", "10.5", "$1,234.56") into integer cents.
 * Rejects zero, negatives, more than two decimal places, and non-numeric input.
 */
export function parseAmountToCents(input: unknown): number {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) throw new ValidationError("Amount must be a number.");
    input = String(input);
  }
  if (typeof input !== "string" || input.trim() === "") {
    throw new ValidationError("Amount is required.");
  }
  const cleaned = input.trim().replace(/^\$/, "").replace(/,/g, "");
  if (/^-/.test(cleaned)) {
    throw new ValidationError("Amount must be greater than zero.");
  }
  const match = /^(\d+)(?:\.(\d*))?$/.exec(cleaned);
  if (!match) {
    throw new ValidationError(`"${input}" is not a valid amount. Use a format like 12.34.`);
  }
  const [, whole, frac = ""] = match;
  if (frac.length > 2) {
    throw new ValidationError("Amount cannot have more than two decimal places.");
  }
  if (whole.length > 9) {
    throw new ValidationError("Amount is too large. The maximum is $1,000,000.00.");
  }
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (cents <= 0) throw new ValidationError("Amount must be greater than zero.");
  if (cents > MAX_EXPENSE_CENTS) {
    throw new ValidationError("Amount is too large. The maximum is $1,000,000.00.");
  }
  return cents;
}

/**
 * Splits totalCents equally among participants.
 * Participants are ordered by ascending member ID; the leftover cents
 * (totalCents mod n) go one each to the first participants in that order.
 * Returns a map memberId -> shareCents whose values sum exactly to totalCents.
 */
export function splitEqually(totalCents: number, participantIds: number[]): Map<number, number> {
  if (!Number.isSafeInteger(totalCents) || totalCents <= 0) {
    throw new ValidationError("Amount must be a positive number of cents.");
  }
  const ordered = [...new Set(participantIds)].sort((a, b) => a - b);
  if (ordered.length === 0) throw new ValidationError("Select at least one participant.");
  if (ordered.length !== participantIds.length) {
    throw new ValidationError("Each participant can only be selected once.");
  }
  const base = Math.floor(totalCents / ordered.length);
  const remainder = totalCents % ordered.length;
  const shares = new Map<number, number>();
  ordered.forEach((id, i) => shares.set(id, base + (i < remainder ? 1 : 0)));
  return shares;
}

export interface ExpenseForBalance {
  payerId: number;
  amountCents: number;
  shares: { memberId: number; shareCents: number }[];
}

/**
 * Net balance per member: positive = should receive, negative = owes.
 * The payer is credited the full amount; each participant is debited their share.
 */
export function computeBalances(
  memberIds: number[],
  expenses: ExpenseForBalance[],
): Map<number, number> {
  const balances = new Map<number, number>(memberIds.map((id) => [id, 0]));
  const add = (id: number, delta: number) => balances.set(id, (balances.get(id) ?? 0) + delta);
  for (const e of expenses) {
    add(e.payerId, e.amountCents);
    for (const s of e.shares) add(s.memberId, -s.shareCents);
  }
  return balances;
}

/** Formats cents as a dollar string, e.g. 3334 -> "$33.34", -2000 -> "-$20.00". */
export function formatCents(cents: number, opts: { signed?: boolean } = {}): string {
  const abs = Math.abs(cents);
  const text = `$${Math.floor(abs / 100).toLocaleString("en-US")}.${String(abs % 100).padStart(2, "0")}`;
  if (cents < 0) return `-${text}`;
  if (opts.signed && cents > 0) return `+${text}`;
  return text;
}
