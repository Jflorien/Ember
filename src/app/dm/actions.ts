"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  newEventId,
  proposedGameEventSchema,
  conditionNameSchema,
  describeEvent,
  type ProposedGameEvent,
} from "@/lib/events";
import { rollDice } from "@/lib/dice";
import { cellDistance, FEET_PER_CELL } from "@/lib/grid";
import {
  ABILITY_KEYS,
  STANDARD_ARRAY,
  readCharacterSheet,
  type AbilityKey,
  type CharacterSheet,
} from "@/lib/characters/sheet";
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

/** Falls back to 'public' when a composer's visibility select is absent. */
function readVisibility(formData: FormData): string {
  const raw = formData.get("visibility");
  return typeof raw === "string" && raw.trim() !== "" ? raw : "public";
}

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

export type CampaignMember = { userId: string; displayName: string; role: string };

/**
 * Everyone who has joined a campaign via invite code — not the DM/owner,
 * who has no membership row (is_campaign_dm checks campaigns.owner_id
 * directly). For the DM console's member-management panel.
 */
export async function getCampaignMembers(campaignId: string): Promise<CampaignMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("user_id, role, users(display_name)")
    .eq("campaign_id", campaignId)
    .order("joined_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const user = row.users as unknown as { display_name: string | null } | null;
    return {
      userId: row.user_id,
      displayName: user?.display_name ?? "Unnamed",
      role: row.role,
    };
  });
}

/**
 * Swaps in a fresh invite code, e.g. after accidentally sharing one in the
 * wrong place. RLS (campaigns_update_owner) already restricts this to the
 * campaign's owner, so there's nothing to check here beyond the update
 * itself succeeding.
 */
export async function regenerateInviteCode(campaignId: string): Promise<EventActionState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("campaigns")
    .update({ invite_code: generateInviteCode() })
    .eq("id", campaignId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dm");
  return {};
}

const ASSIGNABLE_ROLES = ["player", "spectator"] as const;

/**
 * Player <-> spectator only — promoting someone to co-DM (role: 'dm') is a
 * bigger trust delegation than this panel is scoped for, so it's not one of
 * the options here even though the memberships RLS would technically allow
 * a DM to set it.
 */
export async function updateMemberRole(
  campaignId: string,
  userId: string,
  _prevState: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const role = String(formData.get("role") ?? "");
  if (!ASSIGNABLE_ROLES.includes(role as (typeof ASSIGNABLE_ROLES)[number])) {
    return { error: "Pick a valid role." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("memberships")
    .update({ role })
    .eq("campaign_id", campaignId)
    .eq("user_id", userId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dm");
  return {};
}

/**
 * Kicks a member — deletes their membership row only. Any characters they
 * created stay in the campaign as-is; this isn't trying to also decide
 * whether a kicked player's character should be removed from play.
 */
export async function removeMember(campaignId: string, userId: string): Promise<EventActionState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("memberships")
    .delete()
    .eq("campaign_id", campaignId)
    .eq("user_id", userId);

  if (error) {
    return { error: error.message };
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

export type MyCharacter = {
  characterId: string;
  name: string;
  maxHp: number;
  class: string | null;
  level: number;
  sheet: CharacterSheet;
  portraitUrl: string | null;
};
export type PartyMember = {
  characterId: string;
  name: string;
  maxHp: number;
  ownerId: string;
  portraitUrl: string | null;
};

/**
 * Every character in a campaign, for the Party Status Strip, the DM
 * console's target picker, and (via ownerId) building `player:<uuid>`
 * visibility options — visibility is scoped per user, not per character.
 */
export async function getPartyMembers(campaignId: string): Promise<PartyMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("characters")
    .select("id, name, sheet, owner_id, portrait_url")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const sheet = readCharacterSheet(row.sheet);
    return {
      characterId: row.id,
      name: row.name,
      maxHp: sheet.maxHp,
      ownerId: row.owner_id,
      portraitUrl: row.portrait_url,
    };
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
    .select("id, name, sheet, class, level, portrait_url")
    .eq("campaign_id", campaignId)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const sheet = readCharacterSheet(data.sheet);
  return {
    characterId: data.id,
    name: data.name,
    maxHp: sheet.maxHp,
    class: data.class,
    level: data.level,
    sheet,
    portraitUrl: data.portrait_url,
  };
}

/**
 * Real character creation, replacing the old auto-provisioned "Demo
 * character." Max HP is still a fixed default — there's no leveling system
 * to derive it from yet. class is freeform text (matches `characters.class`,
 * no SRD-class catalog required — Ember's own classes aren't seeded either,
 * so a fixed dropdown would be wrong even once SRD content exists). Ability
 * scores come from the SRD standard array (15/14/13/12/10/8), the only
 * generation method built so far — point buy and rolling are real future
 * options this form doesn't offer yet.
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

  const characterClass = String(formData.get("class") ?? "").trim();
  const levelRaw = formData.get("level");
  const level = levelRaw && String(levelRaw).trim() !== "" ? Number(levelRaw) : 1;

  if (!Number.isInteger(level) || level < 1 || level > 20) {
    return { error: "Level must be a whole number from 1 to 20." };
  }

  const abilityScores = {} as Record<AbilityKey, number>;
  const usedScores: number[] = [];
  for (const key of ABILITY_KEYS) {
    const raw = Number(formData.get(`ability-${key}`));
    if (!Number.isInteger(raw)) {
      return { error: "Every ability score must be assigned from the standard array." };
    }
    abilityScores[key] = raw;
    usedScores.push(raw);
  }
  const standardArraySorted = [...STANDARD_ARRAY].sort((a, b) => a - b);
  if (JSON.stringify(usedScores.sort((a, b) => a - b)) !== JSON.stringify(standardArraySorted)) {
    return {
      error: "Each standard array value (15, 14, 13, 12, 10, 8) must be used exactly once.",
    };
  }

  const dexMod = Math.floor((abilityScores.dex - 10) / 2);
  const acRaw = formData.get("ac");
  const ac =
    acRaw && String(acRaw).trim() !== "" ? Number(acRaw) : 10 + dexMod;
  if (!Number.isInteger(ac) || ac < 1) {
    return { error: "Armor class must be a positive whole number." };
  }

  const speedRaw = formData.get("speed");
  const speed = speedRaw && String(speedRaw).trim() !== "" ? Number(speedRaw) : 30;
  if (!Number.isInteger(speed) || speed < 0) {
    return { error: "Speed must be a whole number of feet." };
  }

  const savingThrowProficiencies = formData
    .getAll("saveProficiencies")
    .map((value) => String(value))
    .filter((value): value is AbilityKey => (ABILITY_KEYS as readonly string[]).includes(value));

  const sheet: CharacterSheet = {
    v: 1,
    maxHp: 20,
    ac,
    speed,
    abilityScores,
    savingThrowProficiencies,
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("characters").insert({
    campaign_id: campaignId,
    owner_id: user.id,
    name,
    class: characterClass || null,
    level,
    sheet,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/play");
  return {};
}

// ---------------------------------------------------------------------------
// Spells
// ---------------------------------------------------------------------------

export type Spell = { id: string; name: string; level: number; school: string };

/**
 * Every spell in the compendium, global reference data (not campaign-
 * scoped — see supabase/migrations/0009_spells.sql). No per-character
 * "known spells" filter yet, so this is the full list either way.
 */
export async function getSpells(): Promise<Spell[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("spells")
    .select("id, name, level, school")
    .order("level", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
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

  // Set by the AI co-pilot's Suggest flow when the DM sends its suggestion
  // unedited (src/components/event-composer.tsx) — any edit resets it to
  // "human" client-side, so this only ever reads "model" for a verbatim send.
  const proposedBy = formData.get("proposedBy") === "model" ? "model" : "human";

  const candidate = proposedGameEventSchema.safeParse({
    id: newEventId(),
    session_id: sessionId,
    type: "narration",
    actor: null,
    payload: { v: 1, text },
    visibility: readVisibility(formData),
    proposed_by: proposedBy,
  });

  if (!candidate.success) {
    return { error: candidate.error.issues[0]?.message ?? "Invalid event." };
  }

  const supabase = await createClient();
  return insertEvent(supabase, candidate.data);
}

/**
 * Propose → validate → commit, for casting a spell. `spellName` is
 * denormalized from the spells table into the payload at cast time (the
 * event describes what actually happened, independent of whether that
 * spells row changes later) — everything else about legality (does the
 * caster know this spell, do they have the slot) isn't checked yet, the
 * same "shape, not legality" line every other event type draws today.
 */
export async function proposeCastEvent(
  sessionId: string,
  casterId: string,
  _prevState: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const spellId = String(formData.get("spellId") ?? "");
  const targetIds = formData.getAll("targetIds").map(String).filter(Boolean);
  const slotLevelRaw = formData.get("slotLevel");
  const slotLevel = slotLevelRaw && String(slotLevelRaw).trim() !== "" ? Number(slotLevelRaw) : null;
  const concentration = formData.get("concentration") === "true";

  if (!spellId) {
    return { error: "Pick a spell." };
  }
  if (targetIds.length === 0) {
    return { error: "Pick at least one target." };
  }
  if (slotLevel !== null && (!Number.isInteger(slotLevel) || slotLevel < 0 || slotLevel > 9)) {
    return { error: "Slot level must be a whole number from 0 to 9." };
  }

  const supabase = await createClient();

  const { data: spell, error: spellError } = await supabase
    .from("spells")
    .select("name")
    .eq("id", spellId)
    .maybeSingle();

  if (spellError || !spell) {
    return { error: "Couldn't find that spell." };
  }

  const candidate = proposedGameEventSchema.safeParse({
    id: newEventId(),
    session_id: sessionId,
    type: "cast",
    actor: null,
    payload: {
      v: 1,
      spellId,
      spellName: spell.name,
      casterId,
      targetIds,
      slotLevel,
      concentration,
    },
    visibility: readVisibility(formData),
    proposed_by: "human",
  });

  if (!candidate.success) {
    return { error: candidate.error.issues[0]?.message ?? "Invalid event." };
  }

  return insertEvent(supabase, candidate.data);
}

/**
 * DM Console Panels' "Reveal to party" action: emits a *new* public
 * `reveal` event describing a dm_only event, rather than mutating the
 * hidden one's visibility — the log stays append-only either way.
 * `targetEventId` links back to what was revealed; `description` is
 * denormalized at reveal time (same reasoning as attack's seed/rawRolls)
 * so `/table` can render it without a join back to an event that's still
 * dm_only to everyone but the DM. Scoped to dm_only only; player:<uuid>
 * events already have an intended single audience, so "reveal to
 * everyone" isn't the same action for those.
 */
export async function revealEvent(
  sessionId: string,
  eventId: string,
): Promise<EventActionState> {
  const supabase = await createClient();

  const { data: original, error: fetchError } = await supabase
    .from("events")
    .select("type, payload, visibility")
    .eq("id", eventId)
    .maybeSingle();

  if (fetchError || !original) {
    return { error: "Couldn't find that event." };
  }

  if (original.visibility !== "dm_only") {
    return { error: "Only a dm_only event can be revealed this way." };
  }

  const description = describeEvent(
    original as { type: string; payload: Record<string, unknown> },
  );

  const candidate = proposedGameEventSchema.safeParse({
    id: newEventId(),
    session_id: sessionId,
    type: "reveal",
    actor: null,
    payload: { v: 1, targetEventId: eventId, area: null, toVisibility: "public", description },
    visibility: "public",
    proposed_by: "human",
  });

  if (!candidate.success) {
    return { error: candidate.error.issues[0]?.message ?? "Invalid event." };
  }

  return insertEvent(supabase, candidate.data);
}

/**
 * Propose → validate → commit, for an attack roll. This is the first event
 * type wired to CLAUDE.md's "Dice are rolled server-side. Seeded, logged,
 * auditable." constraint — the client sends attacker/target/modifier/
 * advantage, never a die result; rollDice (src/lib/dice.ts) draws from a
 * crypto-seeded PRNG here, and the seed + every raw roll are committed as
 * part of the event payload, so the outcome can't be spoofed by a
 * compromised or buggy client and can always be re-derived from the log.
 * Target AC is read from the target's own character sheet, never trusted
 * from the form. `actor` stays null like every other propose*Event —
 * events.actor references public.users (the proposing person), not a
 * character; attackerId already lives in the payload where it belongs.
 */
export async function proposeAttackEvent(
  sessionId: string,
  attackerId: string,
  targetId: string,
  _prevState: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const modifier = Number(formData.get("modifier"));
  const advantageRaw = String(formData.get("advantage") ?? "normal");
  const advantage =
    advantageRaw === "advantage" || advantageRaw === "disadvantage" ? advantageRaw : "normal";

  if (!Number.isInteger(modifier)) {
    return { error: "Attack modifier must be a whole number." };
  }

  const supabase = await createClient();

  const { data: targetCharacter, error: targetError } = await supabase
    .from("characters")
    .select("sheet")
    .eq("id", targetId)
    .maybeSingle();

  if (targetError || !targetCharacter) {
    return { error: "Couldn't find the target's armor class." };
  }

  const targetAc = readCharacterSheet(targetCharacter.sheet).ac;

  const dieCount = advantage === "normal" ? 1 : 2;
  const { rolls, seed } = rollDice(20, dieCount);
  const roll = advantage === "disadvantage" ? Math.min(...rolls) : Math.max(...rolls);
  const total = roll + modifier;
  const critical = roll === 20;
  const hit = roll === 1 ? false : critical ? true : total >= targetAc;

  const candidate = proposedGameEventSchema.safeParse({
    id: newEventId(),
    session_id: sessionId,
    type: "attack",
    actor: null,
    payload: {
      v: 1,
      attackerId,
      targetId,
      roll,
      rawRolls: rolls,
      seed,
      modifier,
      total,
      targetAc,
      advantage,
      critical,
      hit,
    },
    visibility: readVisibility(formData),
    proposed_by: "human",
  });

  if (!candidate.success) {
    return { error: candidate.error.issues[0]?.message ?? "Invalid event." };
  }

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
    visibility: readVisibility(formData),
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
    visibility: readVisibility(formData),
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
    visibility: readVisibility(formData),
    proposed_by: "human",
  });

  if (!candidate.success) {
    return { error: candidate.error.issues[0]?.message ?? "Invalid event." };
  }

  const supabase = await createClient();
  return insertEvent(supabase, candidate.data);
}

/**
 * Propose → validate → commit, for handing loot to a character. The `loot`
 * payload's items are freeform (name + quantity, itemId nullable) — no
 * item catalog exists yet, so this doesn't need one to be real. One item
 * per submission, wrapped in the array the schema expects.
 */
export async function proposeLootEvent(
  sessionId: string,
  targetId: string,
  _prevState: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const quantity = Number(formData.get("quantity"));

  if (!name) {
    return { error: "Item needs a name." };
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { error: "Quantity must be a positive whole number." };
  }

  const candidate = proposedGameEventSchema.safeParse({
    id: newEventId(),
    session_id: sessionId,
    type: "loot",
    actor: null,
    payload: { v: 1, targetId, items: [{ itemId: null, name, quantity }] },
    visibility: readVisibility(formData),
    proposed_by: "human",
  });

  if (!candidate.success) {
    return { error: candidate.error.issues[0]?.message ?? "Invalid event." };
  }

  const supabase = await createClient();
  return insertEvent(supabase, candidate.data);
}

/**
 * Propose → validate → commit, for placing terrain on the grid. Map state
 * is never stored — useSessionTerrain folds the committed `terrain` events
 * the same way HP folds damage/heal. DM-only: this is the "DM's real-time
 * authority over the shared map" from DM Console Panels §4, not something
 * a player self-acts on.
 */
export async function proposePlaceTerrainEvent(
  sessionId: string,
  _prevState: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const x = Number(formData.get("x"));
  const y = Number(formData.get("y"));
  const terrainType = String(formData.get("terrainType") ?? "");
  const destructible = formData.get("destructible") === "true";

  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    return { error: "Invalid cell." };
  }

  const candidate = proposedGameEventSchema.safeParse({
    id: newEventId(),
    session_id: sessionId,
    type: "terrain",
    actor: null,
    payload: { v: 1, cell: { x, y }, terrainType, destructible },
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
 * Propose → validate → commit, for moving a character on the grid. `from`
 * is read server-side from the last committed `move` event for this actor
 * (never trusted from the client, same shape as attack's dice and round's
 * counter), defaulting to {0,0} for a character that hasn't moved yet.
 * feetSpent is chessboard distance × 5ft; feetRemaining isn't enforced
 * yet — there's no per-turn movement budget modeled, only the count.
 */
export async function proposeMoveEvent(
  sessionId: string,
  actorId: string,
  _prevState: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const x = Number(formData.get("x"));
  const y = Number(formData.get("y"));

  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    return { error: "Invalid cell." };
  }

  const supabase = await createClient();

  const { data: lastMove, error: lastMoveError } = await supabase
    .from("events")
    .select("payload")
    .eq("session_id", sessionId)
    .eq("type", "move")
    .eq("payload->>actorId", actorId)
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastMoveError) {
    return { error: lastMoveError.message };
  }

  const last = lastMove?.payload as { to?: { x: number; y: number } } | null;
  const from = last?.to ?? { x: 0, y: 0 };
  const to = { x, y };
  const feetSpent = cellDistance(from, to) * FEET_PER_CELL;

  const candidate = proposedGameEventSchema.safeParse({
    id: newEventId(),
    session_id: sessionId,
    type: "move",
    actor: null,
    payload: { v: 1, actorId, from, to, feetSpent, feetRemaining: 0 },
    visibility: "public",
    proposed_by: "human",
  });

  if (!candidate.success) {
    return { error: candidate.error.issues[0]?.message ?? "Invalid event." };
  }

  return insertEvent(supabase, candidate.data);
}

/**
 * Propose → validate → commit, for destroying a destructible prop. Checks
 * server-side that the cell's *current* terrain (the last committed
 * `terrain` event for it) is actually marked destructible — never trusted
 * from the client, same "don't trust the client" shape as move's `from`.
 * useSessionTerrain folds this by clearing the cell, which is also how
 * terrain gets un-placed — there's no separate "clear" event.
 */
export async function proposeDestroyEvent(
  sessionId: string,
  _prevState: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const x = Number(formData.get("x"));
  const y = Number(formData.get("y"));
  const cause = String(formData.get("cause") ?? "").trim() || null;

  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    return { error: "Invalid cell." };
  }

  const supabase = await createClient();

  const { data: lastTerrain, error: lastTerrainError } = await supabase
    .from("events")
    .select("payload")
    .eq("session_id", sessionId)
    .eq("type", "terrain")
    .eq("payload->cell->>x", String(x))
    .eq("payload->cell->>y", String(y))
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastTerrainError) {
    return { error: lastTerrainError.message };
  }

  const terrain = lastTerrain?.payload as { destructible?: boolean } | null;
  if (!terrain || !terrain.destructible) {
    return { error: "That cell has no destructible terrain." };
  }

  const candidate = proposedGameEventSchema.safeParse({
    id: newEventId(),
    session_id: sessionId,
    type: "destroy",
    actor: null,
    payload: { v: 1, cell: { x, y }, cause },
    visibility: "public",
    proposed_by: "human",
  });

  if (!candidate.success) {
    return { error: candidate.error.issues[0]?.message ?? "Invalid event." };
  }

  return insertEvent(supabase, candidate.data);
}

/**
 * Propose → validate → commit, for advancing the round counter. Alternates
 * start/end off the *last committed* round event, queried fresh here —
 * never off whatever a client thinks the round is — so two DMs clicking at
 * once (or one stale tab) can't desync the count: start 1 -> end 1 ->
 * start 2 -> ... No round event yet means this session's first round.
 */
export async function proposeAdvanceRoundEvent(sessionId: string): Promise<EventActionState> {
  const supabase = await createClient();

  const { data: lastRound, error: lastRoundError } = await supabase
    .from("events")
    .select("payload")
    .eq("session_id", sessionId)
    .eq("type", "round")
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastRoundError) {
    return { error: lastRoundError.message };
  }

  const last = lastRound?.payload as { number?: number; phase?: string } | null;
  const wasMidRound = last?.phase === "start";
  const number = wasMidRound ? (last?.number ?? 1) : (last?.number ?? 0) + 1;
  const phase = wasMidRound ? "end" : "start";

  const candidate = proposedGameEventSchema.safeParse({
    id: newEventId(),
    session_id: sessionId,
    type: "round",
    actor: null,
    payload: { v: 1, number, phase },
    visibility: "public",
    proposed_by: "human",
  });

  if (!candidate.success) {
    return { error: candidate.error.issues[0]?.message ?? "Invalid event." };
  }

  return insertEvent(supabase, candidate.data);
}

const MAX_PORTRAIT_BYTES = 5 * 1024 * 1024;
const ALLOWED_PORTRAIT_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/**
 * Uploads to the `character-portraits` Storage bucket (0011) and stamps the
 * public URL onto `characters.portrait_url`. Runs server-side with the same
 * auth session as every other write here — RLS on storage.objects (owns_character)
 * is the real gate, not this check, but failing fast with a clear message is
 * better than a generic storage error.
 */
export async function updateCharacterPortrait(
  characterId: string,
  _prevState: EventActionState,
  formData: FormData,
): Promise<EventActionState> {
  const file = formData.get("portrait");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image to upload." };
  }
  if (!ALLOWED_PORTRAIT_TYPES.includes(file.type)) {
    return { error: "Portrait must be a PNG, JPEG, WebP, or GIF image." };
  }
  if (file.size > MAX_PORTRAIT_BYTES) {
    return { error: "Portrait must be under 5MB." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const extension = file.type.split("/")[1] ?? "png";
  const path = `${characterId}/portrait.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("character-portraits")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { data: publicUrlData } = supabase.storage
    .from("character-portraits")
    .getPublicUrl(path);

  // Cache-bust: the path is stable (one portrait per character), so an
  // unchanged URL would keep serving a cached old image after re-upload.
  const portraitUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("characters")
    .update({ portrait_url: portraitUrl })
    .eq("id", characterId);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath("/play");
  revalidatePath("/dm");
  return {};
}
