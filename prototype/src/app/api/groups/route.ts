import { handle, readJson, service } from "@/lib/api";

export async function GET() {
  return handle(() => service.listGroups());
}

export async function POST(req: Request) {
  return handle(async () => service.createGroup(await readJson(req)), 201);
}
