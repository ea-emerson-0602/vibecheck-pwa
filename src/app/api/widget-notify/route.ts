// src/app/api/widget-notify/route.ts
// Called by Supabase webhook whenever a mood_entry is inserted
// Sends a push notification to the mood owner's partner so their widget refreshes

import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

webpush.setVapidDetails(
  "mailto:your@email.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    // Supabase webhook sends { type, table, record, schema }
    const record = payload.record;
    if (!record?.user_id) {
      return NextResponse.json({ ok: false, reason: "no record" });
    }

    // Find the partner of whoever just set their mood
    const { data: profile } = await supabase
      .from("profiles")
      .select("partner_id")
      .eq("id", record.user_id)
      .single();

    if (!profile?.partner_id) {
      return NextResponse.json({ ok: false, reason: "no partner" });
    }

    // Get partner's push subscription
    const { data: partner } = await supabase
      .from("profiles")
      .select("push_subscription, display_name")
      .eq("id", profile.partner_id)
      .single();

    if (!partner?.push_subscription) {
      return NextResponse.json({ ok: false, reason: "no push subscription" });
    }

    // Send push notification to partner — this will wake their widget
    const subscription = JSON.parse(partner.push_subscription);
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: "Vibe updated ✨",
        body: "Your partner just updated their vibe",
        url: "/home",
      })
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("widget-notify error:", err);
    return NextResponse.json({ ok: false, error: err.message });
  }
}
