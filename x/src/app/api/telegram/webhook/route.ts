import { NextResponse } from "next/server";

// Keep the old path explicit, rather than accidentally running a second webhook engine.
// Production Telegram updates are received by the Python Vercel project at /webhook.
export async function POST() {
  return NextResponse.json({ error: "Use the Python Vercel bot deployment at /webhook." }, {
    status: 410, headers: { "Cache-Control": "no-store" },
  });
}
