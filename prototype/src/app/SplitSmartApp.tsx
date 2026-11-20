"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { formatCents } from "@/lib/money";
import type { GroupDetail, GroupSummary } from "@/lib/splitsmart";

const SELECTED_KEY = "splitsmart:selectedGroupId";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status}).`);
  return body as T;
}

const card = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";
const input =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20";
const button =
  "rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50";

function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  );
}

export default function SplitSmartApp() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    const list = await api<GroupSummary[]>("/api/groups");
    setGroups(list);
    return list;
  }, []);

  const loadDetail = useCallback(async (id: number) => {
    try {
      setDetail(await api<GroupDetail>(`/api/groups/${id}`));
      setLoadError(null);
    } catch (e) {
      setDetail(null);
      setLoadError((e as Error).message);
    }
  }, []);

  // Initial load: restore the previously selected group if it still exists.
  useEffect(() => {
    loadGroups()
      .then((list) => {
        let saved: number | null = null;
        try {
          saved = Number(localStorage.getItem(SELECTED_KEY)) || null;
        } catch {}
        const initial = list.find((g) => g.id === saved) ?? list[0];
        if (initial) setSelectedId(initial.id);
      })
      .catch((e) => setLoadError((e as Error).message));
  }, [loadGroups]);

  useEffect(() => {
    if (selectedId === null) return;
    try {
      localStorage.setItem(SELECTED_KEY, String(selectedId));
    } catch {}
    loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const refresh = useCallback(async () => {
    await loadGroups();
    if (selectedId !== null) await loadDetail(selectedId);
  }, [loadGroups, loadDetail, selectedId]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <h1 className="text-2xl font-bold text-emerald-800">SplitSmart</h1>
          <p className="text-sm text-slate-600">Track shared expenses and see who owes whom.</p>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[260px_1fr]">
        <GroupSidebar
          groups={groups}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onCreated={async (id) => {
            await loadGroups();
            setSelectedId(id);
          }}
        />

        <section className="min-w-0 space-y-6">
          <ErrorText message={loadError} />
          {!detail && !loadError && (
            <div className={`${card} text-slate-600`}>
              {groups.length === 0
                ? "Create your first group to get started."
                : "Select a group to see its details."}
            </div>
          )}
          {detail && (
            <>
              <h2 className="text-xl font-semibold">{detail.name}</h2>
              <div className="grid gap-6 lg:grid-cols-2">
                <MembersPanel group={detail} onChanged={refresh} />
                <BalancesPanel group={detail} />
              </div>
              <ExpenseForm group={detail} onRecorded={refresh} />
              <ExpenseHistory group={detail} />
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function GroupSidebar(props: {
  groups: GroupSummary[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onCreated: (id: number) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const g = await api<{ id: number }>("/api/groups", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setName("");
      await props.onCreated(g.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className={`${card} h-fit space-y-4`}>
      <h2 className="font-semibold">Groups</h2>
      {props.groups.length === 0 ? (
        <p className="text-sm text-slate-500">No groups yet.</p>
      ) : (
        <ul className="space-y-1">
          {props.groups.map((g) => (
            <li key={g.id}>
              <button
                onClick={() => props.onSelect(g.id)}
                aria-current={g.id === props.selectedId}
                className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                  g.id === props.selectedId
                    ? "bg-emerald-100 font-medium text-emerald-900"
                    : "hover:bg-slate-100"
                }`}
              >
                {g.name}
                <span className="block text-xs text-slate-500">
                  {g.memberCount} member{g.memberCount === 1 ? "" : "s"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="space-y-2 border-t border-slate-200 pt-4">
        <label htmlFor="group-name" className="block text-sm font-medium">
          New group
        </label>
        <input
          id="group-name"
          className={input}
          placeholder="e.g. Beach Trip"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
        />
        <button className={`${button} w-full`} disabled={busy}>
          Create group
        </button>
        <ErrorText message={error} />
      </form>
    </aside>
  );
}

function MembersPanel({ group, onChanged }: { group: GroupDetail; onChanged: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/groups/${group.id}/members`, {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setName("");
      await onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={card}>
      <h3 className="mb-3 font-semibold">Members</h3>
      {group.members.length === 0 ? (
        <p className="text-sm text-slate-500">No members yet. Add the people sharing expenses.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {group.members.map((m) => (
            <li key={m.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm">
              {m.name}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} className="mt-4 flex gap-2">
        <label htmlFor="member-name" className="sr-only">
          Member name
        </label>
        <input
          id="member-name"
          className={input}
          placeholder="Member name"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
        />
        <button className={button} disabled={busy}>
          Add
        </button>
      </form>
      <ErrorText message={error} />
    </div>
  );
}

function BalancesPanel({ group }: { group: GroupDetail }) {
  const total = group.balances.reduce((sum, b) => sum + b.balanceCents, 0);
  return (
    <div className={card}>
      <h3 className="mb-3 font-semibold">Balances</h3>
      {group.balances.length === 0 ? (
        <p className="text-sm text-slate-500">Add members to see balances.</p>
      ) : (
        <>
          <ul className="divide-y divide-slate-100" data-testid="balances">
            {group.balances.map((b) => (
              <li key={b.memberId} className="flex items-center justify-between py-2 text-sm">
                <span>{b.name}</span>
                <span
                  className={`font-mono font-medium ${
                    b.balanceCents > 0
                      ? "text-emerald-700"
                      : b.balanceCents < 0
                        ? "text-red-700"
                        : "text-slate-500"
                  }`}
                >
                  {formatCents(b.balanceCents, { signed: true })}
                  <span className="ml-2 font-sans text-xs font-normal text-slate-500">
                    {b.balanceCents > 0 ? "gets back" : b.balanceCents < 0 ? "owes" : "settled"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-slate-200 pt-2 text-xs text-slate-500">
            Sum of balances: <span className="font-mono">{formatCents(total)}</span>
          </p>
        </>
      )}
    </div>
  );
}

function ExpenseForm({ group, onRecorded }: { group: GroupDetail; onRecorded: () => Promise<void> }) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [payerId, setPayerId] = useState("");
  const [participants, setParticipants] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Reset the form when switching groups; default to everyone participating.
  const memberKey = group.members.map((m) => m.id).join(",");
  useEffect(() => {
    setPayerId("");
    setParticipants(new Set(group.members.map((m) => m.id)));
    setError(null);
    setSuccess(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id, memberKey]);

  if (group.members.length === 0) {
    return (
      <div className={`${card} text-sm text-slate-500`}>
        <h3 className="mb-2 font-semibold text-slate-900">Record an expense</h3>
        Add at least one member before recording expenses.
      </div>
    );
  }

  function toggle(id: number) {
    setParticipants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await api(`/api/groups/${group.id}/expenses`, {
        method: "POST",
        body: JSON.stringify({
          description,
          amount,
          payerId: payerId === "" ? null : Number(payerId),
          participantIds: [...participants],
        }),
      });
      setSuccess(`Recorded "${description.trim()}".`);
      setDescription("");
      setAmount("");
      await onRecorded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={card}>
      <h3 className="mb-4 font-semibold">Record an expense</h3>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label htmlFor="exp-desc" className="mb-1 block text-sm font-medium">
            Description
          </label>
          <input
            id="exp-desc"
            className={input}
            placeholder="e.g. Dinner"
            value={description}
            maxLength={120}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="exp-amount" className="mb-1 block text-sm font-medium">
            Amount ($)
          </label>
          <input
            id="exp-amount"
            className={input}
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="exp-payer" className="mb-1 block text-sm font-medium">
            Paid by
          </label>
          <select
            id="exp-payer"
            className={input}
            value={payerId}
            onChange={(e) => setPayerId(e.target.value)}
          >
            <option value="">Select payer…</option>
            {group.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1 text-sm font-medium">Split equally between</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {group.members.map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-emerald-700"
                  checked={participants.has(m.id)}
                  onChange={() => toggle(m.id)}
                />
                {m.name}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button className={button} disabled={busy}>
          Record expense
        </button>
        {success && <span className="text-sm text-emerald-700">{success}</span>}
      </div>
      <ErrorText message={error} />
    </form>
  );
}

function ExpenseHistory({ group }: { group: GroupDetail }) {
  return (
    <div className={card}>
      <h3 className="mb-3 font-semibold">Expense history</h3>
      {group.expenses.length === 0 ? (
        <p className="text-sm text-slate-500">No expenses recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Description</th>
                <th className="py-2 pr-4 text-right">Amount</th>
                <th className="py-2 pr-4">Paid by</th>
                <th className="py-2">Shares</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {group.expenses.map((e) => (
                <tr key={e.id} className="align-top">
                  <td className="whitespace-nowrap py-2 pr-4 text-slate-500">
                    {new Date(e.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-2 pr-4">{e.description}</td>
                  <td className="py-2 pr-4 text-right font-mono">{formatCents(e.amountCents)}</td>
                  <td className="py-2 pr-4">{e.payer.name}</td>
                  <td className="py-2 text-slate-600">
                    {e.participants
                      .map((p) => `${p.name} ${formatCents(p.shareCents)}`)
                      .join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
