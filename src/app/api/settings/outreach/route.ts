import type { NextRequest } from "next/server";
import { outreachSettingsSchema } from "@/lib/contract";
import { handle, parseBody } from "@/server/http";
import { getOutreachSettings, saveOutreachSettings } from "@/server/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => Response.json(await getOutreachSettings()));
}

export function PUT(req: NextRequest) {
  return handle(async () => {
    const settings = await parseBody(req, outreachSettingsSchema);
    return Response.json(await saveOutreachSettings(settings));
  });
}
