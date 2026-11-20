import { NextResponse } from "next/server";
import { ValidationError } from "./money";
import { NotFoundError, createService } from "./splitsmart";
import { prisma } from "./prisma";

export const service = createService(prisma);

/** Runs a handler and converts domain errors into JSON error responses. */
export async function handle<T>(fn: () => Promise<T>, successStatus = 200) {
  try {
    return NextResponse.json(await fn(), { status: successStatus });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error(err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

/** Parses a JSON request body, rejecting malformed JSON with a readable message. */
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body;
  } catch {
    // fall through
  }
  throw new ValidationError("Request body must be a JSON object.");
}
