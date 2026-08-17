"use server";

import { createClient } from "@/lib/supabase/server";
import {
  newEventId,
  proposedGameEventSchema,
  conditionNameSchema,
  type ProposedGameEvent,
} from "@/lib/events";
import type { SupabaseClient } from "@supabase/supabase-js";

export type EventActionState = {
  error?: string;
};

async function insertEvent(
  supabase: SupabaseClient,
  event: ProposedGameEvent,
): Promise<{ error?: string }> {
  const { error } = await supabase.from("events").insert({
    id: event.id,
    session_id: event.session_id,
    type: event.type,
    actor: event.actor,
    payload: event.payload,
    visibility: event.visibility,
    proposed_by: event.proposed_by,
  });

  return error ? { error: error.message } : {};
}

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
  return insertEvent(supabase, candidate.data);
}

/**
 * Finds the current user's demo character in the given campaign, creating
 * one if this is their first visit. Same stand-in role as
 * getOrCreateDemoSession — real character creation doesn't exist yet.
 */
export async function getOrCreateDemoCharacter(
  campaignId: string,
): Promise<{ characterId: string; maxHp: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not signed in.");
  }

  const DEMO_MAX_HP = 20;

  const { data: existing, error: readError } = await supabase
    .from("characters")
    .select("id, sheet")
    .eq("campaign_id", campaignId)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (readError) {
    throw new Error(readError.message);
  }

  if (existing) {
    const sheet = existing.sheet as { maxHp?: number } | null;
    return { characterId: existing.id, maxHp: sheet?.maxHp ?? DEMO_MAX_HP };
  }

  const { data: created, error: insertError } = await supabase
    .from("characters")
    .insert({
      campaign_id: campaignId,
      owner_id: user.id,
      name: "Demo character",
      sheet: { maxHp: DEMO_MAX_HP },
    })
    .select("id")
    .single();

  if (insertError || !created) {
    throw new Error(insertError?.message ?? "Could not create character.");
  }

  return { characterId: created.id, maxHp: DEMO_MAX_HP };
}

/**
 * Propose → validate → commit, for damage against a character. Nothing
 * writes a character's HP directly — HP is only ever a fold over committed
 * damage/heal events (see CharacterHp), the same way CLAUDE.md warns HP
 * living in a context window drifts: it doesn't drift if it's never stored,
 * only computed.
 */
export async function proposeDamageEvent(
  sessionId: string,
  targetId: string,
  _prevState: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const amount = Number(formData.get("amount"));
  const damageType = String(formData.get("damageType") ?? "");

  if (!Number.isInteger(amount) || amount <= 0) {
    return { error: "Damage must be a positive whole number." };
  }

  const candidate = proposedGameEventSchema.safeParse({
    id: newEventId(),
    session_id: sessionId,
    type: "damage",
    actor: null,
    payload: { v: 1, targetId, amount, damageType, source: null },
    visibility: "public",
    proposed_by: "human",
  });

  if (!candidate.success) {
    return { error: candidate.error.issues[0]?.message ?? "Invalid event." };
  }

  const supabase = await createClient();
  return insertEvent(supabase, candidate.data);
}

export async function proposeHealEvent(
  sessionId: string,
  targetId: string,
  _prevState: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const amount = Number(formData.get("amount"));

  if (!Number.isInteger(amount) || amount <= 0) {
    return { error: "Healing must be a positive whole number." };
  }

  const candidate = proposedGameEventSchema.safeParse({
    id: newEventId(),
    session_id: sessionId,
    type: "heal",
    actor: null,
    payload: { v: 1, targetId, amount, source: null },
    visibility: "public",
    proposed_by: "human",
  });

  if (!candidate.success) {
    return { error: candidate.error.issues[0]?.message ?? "Invalid event." };
  }

  const supabase = await createClient();
  return insertEvent(supabase, candidate.data);
}

/**
 * Propose → validate → commit, for applying or removing a condition. Like
 * HP, active conditions are never stored as a column — they're a fold over
 * apply/remove condition events (see CharacterConditions), where the last
 * event for a given condition name wins.
 */
export async function proposeConditionEvent(
  sessionId: string,
  targetId: string,
  _prevState: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const conditionResult = conditionNameSchema.safeParse(formData.get("condition"));
  const action = formData.get("action") === "remove" ? "remove" : "apply";
  const durationRaw = formData.get("durationRounds");
  const durationRounds =
    durationRaw && String(durationRaw).trim() !== "" ? Number(durationRaw) : null;

  if (!conditionResult.success) {
    return { error: "Pick a condition." };
  }

  if (durationRounds !== null && (!Number.isInteger(durationRounds) || durationRounds <= 0)) {
    return { error: "Duration must be a positive whole number of rounds, or left blank." };
  }

  const candidate = proposedGameEventSchema.safeParse({
    id: newEventId(),
    session_id: sessionId,
    type: "condition",
    actor: null,
    payload: {
      v: 1,
      targetId,
      condition: conditionResult.data,
      action,
      durationRounds,
      source: null,
    },
    visibility: "public",
    proposed_by: "human",
  });

  if (!candidate.success) {
    return { error: candidate.error.issues[0]?.message ?? "Invalid event." };
  }

  const supabase = await createClient();
  return insertEvent(supabase, candidate.data);
}
