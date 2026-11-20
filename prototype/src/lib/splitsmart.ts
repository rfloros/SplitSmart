import type { PrismaClient } from "@prisma/client";
import { ValidationError, computeBalances, parseAmountToCents, splitEqually } from "./money";

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

const MAX_NAME = 60;
const MAX_DESCRIPTION = 120;

function requireText(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`${label} is required.`);
  }
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length > max) throw new ValidationError(`${label} must be ${max} characters or fewer.`);
  return text;
}

function requireId(value: unknown, label: string): number {
  const n = typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : value;
  if (typeof n !== "number" || !Number.isSafeInteger(n) || n <= 0) {
    throw new ValidationError(`${label} ID ${JSON.stringify(value)} is not valid. IDs must be positive whole numbers.`);
  }
  return n;
}

export interface GroupSummary {
  id: number;
  name: string;
  memberCount: number;
  createdAt: string;
}

export interface GroupDetail {
  id: number;
  name: string;
  members: { id: number; name: string }[];
  expenses: {
    id: number;
    description: string;
    amountCents: number;
    payer: { id: number; name: string };
    participants: { memberId: number; name: string; shareCents: number }[];
    createdAt: string;
  }[];
  balances: { memberId: number; name: string; balanceCents: number }[];
}

export function createService(db: PrismaClient) {
  async function getGroupOrThrow(groupIdInput: unknown) {
    const groupId = requireId(groupIdInput, "Group");
    const group = await db.group.findUnique({ where: { id: groupId } });
    if (!group) throw new NotFoundError(`Group ${groupId} does not exist.`);
    return group;
  }

  return {
    async listGroups(): Promise<GroupSummary[]> {
      const groups = await db.group.findMany({
        orderBy: { id: "asc" },
        include: { _count: { select: { members: true } } },
      });
      return groups.map((g) => ({
        id: g.id,
        name: g.name,
        memberCount: g._count.members,
        createdAt: g.createdAt.toISOString(),
      }));
    },

    async createGroup(input: { name?: unknown }) {
      const name = requireText(input.name, "Group name", MAX_NAME);
      const g = await db.group.create({ data: { name } });
      return { id: g.id, name: g.name };
    },

    async addMember(groupIdInput: unknown, input: { name?: unknown }) {
      const group = await getGroupOrThrow(groupIdInput);
      const name = requireText(input.name, "Member name", MAX_NAME);
      const existing = await db.member.findMany({ where: { groupId: group.id } });
      if (existing.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
        throw new ValidationError(`"${name}" is already a member of this group.`);
      }
      const m = await db.member.create({ data: { name, groupId: group.id } });
      return { id: m.id, name: m.name };
    },

    async recordExpense(
      groupIdInput: unknown,
      input: { description?: unknown; amount?: unknown; payerId?: unknown; participantIds?: unknown },
    ) {
      const group = await getGroupOrThrow(groupIdInput);
      const description = requireText(input.description, "Description", MAX_DESCRIPTION);
      const amountCents = parseAmountToCents(input.amount);
      if (input.payerId === undefined || input.payerId === null || input.payerId === "") {
        throw new ValidationError("Select who paid.");
      }
      const payerId = requireId(input.payerId, "Payer");
      if (!Array.isArray(input.participantIds) || input.participantIds.length === 0) {
        throw new ValidationError("Select at least one participant.");
      }
      const participantIds = input.participantIds.map((p) => requireId(p, "Participant"));

      const members = await db.member.findMany({ where: { groupId: group.id }, select: { id: true } });
      const memberIds = new Set(members.map((m) => m.id));
      if (!memberIds.has(payerId)) {
        throw new ValidationError(`Payer (ID ${payerId}) is not a member of this group.`);
      }
      const outsiders = participantIds.filter((id) => !memberIds.has(id));
      if (outsiders.length > 0) {
        throw new ValidationError(
          `Participant ID${outsiders.length > 1 ? "s" : ""} ${outsiders.join(", ")} ${
            outsiders.length > 1 ? "are" : "is"
          } not a member of this group.`,
        );
      }

      const shares = splitEqually(amountCents, participantIds);
      const expense = await db.expense.create({
        data: {
          description,
          amountCents,
          groupId: group.id,
          payerId,
          participants: {
            create: [...shares].map(([memberId, shareCents]) => ({ memberId, shareCents })),
          },
        },
      });
      return { id: expense.id, amountCents, shares: Object.fromEntries(shares) };
    },

    async getGroupDetail(groupIdInput: unknown): Promise<GroupDetail> {
      const group = await getGroupOrThrow(groupIdInput);
      const [members, expenses] = await Promise.all([
        db.member.findMany({ where: { groupId: group.id }, orderBy: { id: "asc" } }),
        db.expense.findMany({
          where: { groupId: group.id },
          orderBy: { id: "desc" },
          include: { payer: true, participants: { include: { member: true } } },
        }),
      ]);
      const balances = computeBalances(
        members.map((m) => m.id),
        expenses.map((e) => ({ payerId: e.payerId, amountCents: e.amountCents, shares: e.participants })),
      );
      return {
        id: group.id,
        name: group.name,
        members: members.map((m) => ({ id: m.id, name: m.name })),
        expenses: expenses.map((e) => ({
          id: e.id,
          description: e.description,
          amountCents: e.amountCents,
          payer: { id: e.payer.id, name: e.payer.name },
          participants: e.participants
            .sort((a, b) => a.memberId - b.memberId)
            .map((p) => ({ memberId: p.memberId, name: p.member.name, shareCents: p.shareCents })),
          createdAt: e.createdAt.toISOString(),
        })),
        balances: members.map((m) => ({
          memberId: m.id,
          name: m.name,
          balanceCents: balances.get(m.id) ?? 0,
        })),
      };
    },
  };
}
