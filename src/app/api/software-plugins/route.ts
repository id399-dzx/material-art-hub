import { NextResponse } from "next/server";
import { loadPublicSoftwarePlugins, PUBLIC_PLUGIN_CATALOG_ERROR } from "@/lib/software-plugins/public-catalog";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function GET() {
  try {
    return NextResponse.json({ plugins: await loadPublicSoftwarePlugins() }, { headers });
  } catch {
    return NextResponse.json({ error: PUBLIC_PLUGIN_CATALOG_ERROR }, { status: 503, headers });
  }
}
