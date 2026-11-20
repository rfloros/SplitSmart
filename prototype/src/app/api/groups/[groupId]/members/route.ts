import { handle, readJson, service } from "@/lib/api";

type Ctx = { params: Promise<{ groupId: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { groupId } = await params;
  return handle(async () => service.addMember(groupId, await readJson(req)), 201);
}
