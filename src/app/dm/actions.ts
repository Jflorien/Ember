"use server";

import { createClient } from "@/lib/supabase/server";
import { newEventId, proposedGameEventSchema } from "@/lib/events";

export type EventActionState = {
  error?: string;
};

/**
 * Finds the current user's demo campaign/session, creating them if this is
 * their first visit. Stand-in for real campaign/character creation, which
 * doesn't exist yet — this exists only to give "one event end-to-end" (the
 * DM console proposing an event, the table view receiving it live) a
 * session to attach events to.
 */
export async function getOrCreateDemoSession(): Promise<{
  campaignId: string;
  sessionId: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not signed in.");
  }

  let campaignId: string;

  const { data: existingCampaign, error: campaignReadError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (campaignReadError) {
    throw new Error(campaignReadError.message);
  }

  if (existingCampaign) {
    campaignId = existingCampaign.id;
  } else {
    const { data: newCampaign, error: campaignInsertError } = await supabase
      .from("campaigns")
      .insert({ owner_id: user.id, name: "Demo campaign" })
      .select("id")
      .single();

    if (campaignInsertError || !newCampaign) {
      throw new Error(campaignInsertError?.message ?? "Could not create campaign.");
    }

    campaignId = newCampaign.id;
  }

  const { data: existingSession, error: sessionReadError } = await supabase
    .from("sessions")
    .select("id")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionReadError) {
    throw new Error(sessionReadError.message);
  }

  if (existingSession) {
    return { campaignId, sessionId: existingSession.id };
  }

  const { data: newSession, error: sessionInsertError } = await supabase
    .from("sessions")
    .insert({ campaign_id: campaignId, status: "active" })
    .select("id")
    .single();

  if (sessionInsertError || !newSession) {
    throw new Error(sessionInsertError?.message ?? "Could not create session.");
  }

  return { campaignId, sessionId: newSession.id };
}

/**
 * Propose → validate → commit, for a single narration event. This is the
 * whole architecture in miniature: the rules engine here is just zod
 * (proposedGameEventSchema) — legality checks against game state don't
 * exist yet — but nothing after this point ever writes to `events` except
 * through this same validated shape.
 */
export async function proposeNarrationEvent(
  sessionId: string,
  _prevState: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const text = String(formData.get("text") ?? "").trim();

  if (!text) {
    return { error: "Narration can't be empty." };
  }

  const candidate = proposedGameEventSchema.safeParse({
    id: newEventId(),
    session_id: sessionId,
    type: "narration",
    actor: null,
    payload: { v: 1, text },
    visibility: "public",
    proposed_by: "human",
  });

  if (!candidate.success) {
    return { error: candidate.error.issues[0]?.message ?? "Invalid event." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("events").insert({
    id: candidate.data.id,
    session_id: candidate.data.session_id,
    type: candidate.data.type,
    actor: candidate.data.actor,
    payload: candidate.data.payload,
    visibility: candidate.data.visibility,
    proposed_by: candidate.data.proposed_by,
  });

  if (error) {
    return { error: error.message };
  }

  return {};
}
