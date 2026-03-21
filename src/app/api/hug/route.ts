// src/app/api/hug/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { toUserId, fromName } = await req.json();

  // Reuse the notify route logic
  const notifyRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      toUserId,
      title: `${fromName} sent you a hug 🫂`,
      body: "They're thinking of you right now ♡",
    }),
  });

  return NextResponse.json({ ok: true });
}
