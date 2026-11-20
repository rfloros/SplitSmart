import { handle, service } from "@/lib/api";

type Ctx = { params: Promise<{ groupId: string }> };

/** Members, expense history, and balances for one group. */
export async function GET(_req: Request, { params }: Ctx) {
  const { groupId } = await params;
  return handle(() => service.getGroupDetail(groupId));
}
