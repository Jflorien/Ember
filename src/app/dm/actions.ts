"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
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

const INVITE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

function generateInviteCode(length = 8): string {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += INVITE_CODE_ALPHABET[bytes[i] % INVITE_CODE_ALPHABET.length];
  }
  return code;
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export type DmCampaign = { id: string; name: string; inviteCode: string; sessionId: string };
export type CampaignSummary = { id: string; name: string };

/** Every campaign the current user DMs, most recently created first. */
export async function getMyDmCampaigns(): Promise<CampaignSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data, error } = await supabase
    .from("campaigns")
    .select("id, name")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * A campaign the current user DMs — the one named by `campaignId` if given
 * and actually theirs, otherwise their most recently created one. Null if
 * they own no campaigns, or `campaignId` doesn't name one of theirs.
 */
export async function getMyDmCampaign(campaignId?: string): Promise<DmCampaign | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  let query = supabase.from("campaigns").select("id, name, invite_code").eq("owner_id", user.id);
  query = campaignId
    ? query.eq("id", campaignId)
    : query.order("created_at", { ascending: false }).limit(1);

  const { data: campaign, error } = await query.maybeSingle();

  if (error) throw new Error(error.message);
  if (!campaign) return null;

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id")
    .eq("campaign_id", campaign.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionError) throw new Error(sessionError.message);

  const sessionId: string = session
    ? session.id
    : await (async () => {
        const { data: newSession, error: insertError } = await supabase
          .from("sessions")
          .insert({ campaign_id: campaign.id, status: "active" })
          .select("id")
          .single();
        if (insertError || !newSession) {
          throw new Error(insertError?.message ?? "Could not create session.");
        }
        return newSession.id as string;
      })();

  return {
    id: campaign.id,
    name: campaign.name,
    inviteCode: campaign.invite_code,
    sessionId,
  };
}

/**
 * Real campaign creation, replacing the old auto-provisioned "Demo
 * campaign." Generates an invite code and the first session in the same
 * step, since a DM console with no session to attach events to isn't
 * useful.
 */
export async function createCampaign(
  _prevState: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Campaign needs a name." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .insert({ owner_id: user.id, name, invite_code: generateInviteCode() })
    .select("id")
    .single();

  if (campaignError || !campaign) {
    return { error: campaignError?.message ?? "Could not create campaign." };
  }

  const { error: sessionError } = await supabase
    .from("sessions")
    .insert({ campaign_id: campaign.id, status: "active" });

  if (sessionError) {
    return { error: sessionError.message };
  }

  revalidatePath("/dm");
  return {};
}

export type PlayerCampaign = { id: string; name: string; sessionId: string };

/** Every campaign the current user can see on /play: joined-as-member first, then owned. */
export async function getMyPlayerCampaigns(): Promise<CampaignSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const [{ data: memberships, error: membershipError }, { data: owned, error: ownedError }] =
    await Promise.all([
      supabase
        .from("memberships")
        .select("campaigns(id, name)")
        .eq("user_id", user.id)
        .order("joined_at", { ascending: false }),
      supabase
        .from("campaigns")
        .select("id, name")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

  if (membershipError) throw new Error(membershipError.message);
  if (ownedError) throw new Error(ownedError.message);

  type CampaignRow = { id: string; name: string };
  const memberCampaigns = (memberships ?? []).flatMap((row) => {
    const c = row.campaigns as unknown as CampaignRow | CampaignRow[] | null;
    return c ? (Array.isArray(c) ? c : [c]) : [];
  });

  const seen = new Set<string>();
  const combined: CampaignSummary[] = [];
  for (const c of [...memberCampaigns, ...(owned ?? [])]) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    combined.push(c);
  }
  return combined;
}

/**
 * A campaign the current user can see on /play — the one named by
 * `campaignId` if given and visible to them, otherwise preferring a
 * campaign they've joined as a member over one they own (so a DM can still
 * preview the player app for their own game as a fallback). Null if
 * neither applies.
 */
export async function getMyPlayerCampaign(campaignId?: string): Promise<PlayerCampaign | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  let campaign: { id: string; name: string } | null = null;

  if (campaignId) {
    const { data, error } = await supabase
      .from("campaigns")
      .select("id, name")
      .eq("id", campaignId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    campaign = data;
  } else {
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("campaigns(id, name)")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (membershipError) throw new Error(membershipError.message);

    type CampaignRow = { id: string; name: string };
    const memberCampaign = membership?.campaigns as unknown as CampaignRow | CampaignRow[] | null;
    const resolvedMemberCampaign = Array.isArray(memberCampaign)
      ? memberCampaign[0]
      : memberCampaign;

    campaign =
      resolvedMemberCampaign ??
      (
        await supabase
          .from("campaigns")
          .select("id, name")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data;
  }

  if (!campaign) return null;

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id")
    .eq("campaign_id", campaign.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionError) throw new Error(sessionError.message);
  if (!session) return null;

  return { id: campaign.id, name: campaign.name, sessionId: session.id };
}

/** Redeems an invite code, adding the current user as a player. */
export async function joinCampaignByCode(
  code: string,
): Promise<{ campaignId?: string; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_campaign_by_code", {
    p_invite_code: code.trim().toUpperCase(),
  });

  if (error) {
    return { error: error.message.includes("Invalid invite code") ? "Invalid invite code." : error.message };
  }

  return { campaignId: data as string };
}

/** Form-bound wrapper around joinCampaignByCode for the inline /play form. */
export async function joinCampaignAction(
  _prevState: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) {
    return { error: "Enter an invite code." };
  }

  const result = await joinCampaignByCode(code);
  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/play");
  return {};
}

// ---------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------

export type MyCharacter = { characterId: string; maxHp: number };
export type PartyMember = { characterId: string; name: string; maxHp: number };

/**
 * Every character in a campaign, for the Party Status Strip and as the
 * option list for the DM console's target picker.
 */
export async function getPartyMembers(campaignId: string): Promise<PartyMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("characters")
    .select("id, name, sheet")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const sheet = row.sheet as { maxHp?: number } | null;
    return { characterId: row.id, name: row.name, maxHp: sheet?.maxHp ?? 20 };
  });
}

/** The current user's character in a campaign, or null if they haven't made one yet. */
export async function getMyCharacter(campaignId: string): Promise<MyCharacter | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");

  const { data, error } = await supabase
    .from("characters")
    .select("id, sheet")
    .eq("campaign_id", campaignId)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const sheet = data.sheet as { maxHp?: number } | null;
  return { characterId: data.id, maxHp: sheet?.maxHp ?? 20 };
}

/**
 * Real character creation, replacing the old auto-provisioned "Demo
 * character." Max HP is still a fixed default — there's no class/level
 * system or SRD content seeded yet to derive it from.
 */
export async function createCharacter(
  campaignId: string,
  _prevState: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Character needs a name." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("characters").insert({
    campaign_id: campaignId,
    owner_id: user.id,
    name,
    sheet: { maxHp: 20 },
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/play");
  return {};
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

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
