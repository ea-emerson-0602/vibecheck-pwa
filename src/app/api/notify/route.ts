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
  const { toUserId, title, body, url = "/" } = await req.json();

  const { data: profile } = await supabase
    .from("profiles")
    .select("push_subscription")
    .eq("id", toUserId)
    .single();

  if (!profile?.push_subscription) {
    return NextResponse.json({ ok: false, reason: "no subscription" });
  }

  try {
    const subscription = JSON.parse(profile.push_subscription);
    await webpush.sendNotification(
      subscription,
      JSON.stringify({ title, body, url })
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err.statusCode === 410) {
      await supabase
        .from("profiles")
        .update({ push_subscription: null })
        .eq("id", toUserId);
    }
    return NextResponse.json({ ok: false, error: err.message });
  }
}