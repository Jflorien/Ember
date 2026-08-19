"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { newEventId } from "@/lib/events";
import { rollDice } from "@/lib/dice";
import { generateInviteCode } from "@/lib/invite-code";
import type { CharacterSheet } from "@/lib/characters/sheet";
import type { EventActionState } from "@/app/dm/actions";

/**
 * Seeds a complete, self-contained example encounter — campaign, party, a
 * mapped-out crypt, and an event log with a real fight in it — so the three
 * surfaces have something to actually show.
 *
 * It always creates a NEW campaign rather than filling in an existing one:
 * seeding is meant to be repeatable and to never touch real table data.
 *
 * Everything goes through the same tables, triggers and RLS as hand-authored
 * play. There is no "demo mode" anywhere in the app — a seeded campaign is
 * indistinguishable from one a DM built by hand, which is the point: if the
 * demo renders, the real thing renders.
 */

type Cell = { x: number; y: number };

const CHAMBER = { left: 2, right: 13, top: 1, bottom: 8, doorY: 5 };

/** A crypt chamber: outer wall, a doorway west, braziers, rubble, crates. */
function buildTerrain(): Array<{
  cell: Cell;
  terrainType: "wall" | "difficult" | "hazard" | "prop";
  destructible: boolean;
}> {
  const out: ReturnType<typeof buildTerrain> = [];
  const wall = (x: number, y: number) =>
    out.push({ cell: { x, y }, terrainType: "wall", destructible: false });

  for (let x = CHAMBER.left; x <= CHAMBER.right; x++) {
    wall(x, CHAMBER.top);
    wall(x, CHAMBER.bottom);
  }
  for (let y = CHAMBER.top + 1; y < CHAMBER.bottom; y++) {
    if (y !== CHAMBER.doorY) wall(CHAMBER.left, y); // gap = the way in
    wall(CHAMBER.right, y);
  }

  // Braziers — the only light, and the only thing that hurts to stand in.
  out.push({ cell: { x: 5, y: 3 }, terrainType: "hazard", destructible: false });
  out.push({ cell: { x: 10, y: 3 }, terrainType: "hazard", destructible: false });

  // Collapsed ceiling across the middle of the room.
  for (const cell of [
    { x: 7, y: 4 },
    { x: 8, y: 4 },
    { x: 7, y: 5 },
    { x: 8, y: 5 },
  ]) {
    out.push({ cell, terrainType: "difficult", destructible: false });
  }

  // Grave goods — destructible, so the Destroy mode has something to hit.
  for (const cell of [
    { x: 4, y: 6 },
    { x: 5, y: 6 },
    { x: 11, y: 6 },
  ]) {
    out.push({ cell, terrainType: "prop", destructible: true });
  }

  return out;
}

function sheet(overrides: Partial<CharacterSheet> & { maxHp: number }): CharacterSheet {
  return {
    v: 1,
    ac: 14,
    speed: 30,
    abilityScores: { str: 12, dex: 12, con: 12, int: 12, wis: 12, cha: 12 },
    savingThrowProficiencies: [],
    ...overrides,
  };
}

/**
 * The "monster" is a character row owned by the DM. There is no NPC or
 * stat-block system yet (see CLAUDE.md's Not built), and `attack`'s
 * validation trigger requires a real character in the same campaign — so
 * until an NPC model exists, an NPC *is* a character the DM owns. Worth
 * revisiting when encounter staging is real.
 */
const CAST = [
  {
    key: "rowan",
    name: "Rowan Ashbound",
    class: "Path of the Wildfire Barbarian",
    level: 3,
    at: { x: 3, y: 5 },
    sheet: sheet({
      maxHp: 32,
      ac: 14,
      speed: 40,
      abilityScores: { str: 16, dex: 14, con: 15, int: 8, wis: 12, cha: 10 },
      savingThrowProficiencies: ["str", "con"],
    }),
  },
  {
    key: "sera",
    name: "Sera Vint",
    class: "College of Battlechants Bard",
    level: 3,
    at: { x: 3, y: 4 },
    sheet: sheet({
      maxHp: 24,
      ac: 13,
      speed: 30,
      abilityScores: { str: 8, dex: 14, con: 12, int: 13, wis: 10, cha: 16 },
      savingThrowProficiencies: ["dex", "cha"],
    }),
  },
  {
    key: "thane",
    name: "Thane Orrek",
    class: "Stoneborn Fighter",
    level: 3,
    at: { x: 4, y: 6 },
    sheet: sheet({
      maxHp: 34,
      ac: 18,
      speed: 25,
      abilityScores: { str: 15, dex: 10, con: 16, int: 10, wis: 13, cha: 8 },
      savingThrowProficiencies: ["str", "con"],
    }),
  },
  {
    key: "wight",
    name: "Cinder Wight",
    class: "Ash-Blooded revenant",
    level: 4,
    at: { x: 11, y: 4 },
    sheet: sheet({
      maxHp: 45,
      ac: 15,
      speed: 30,
      abilityScores: { str: 15, dex: 13, con: 16, int: 10, wis: 12, cha: 14 },
      savingThrowProficiencies: ["con"],
    }),
  },
] as const;

type EventRow = {
  id: string;
  session_id: string;
  type: string;
  actor: null;
  payload: Record<string, unknown>;
  visibility: string;
  proposed_by: string;
};

export async function seedDemoCampaign(): Promise<EventActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .insert({
      owner_id: user.id,
      name: "The Ashfall Crypt",
      invite_code: generateInviteCode(),
    })
    .select("id")
    .single();

  if (campaignError || !campaign) {
    return { error: campaignError?.message ?? "Could not create the demo campaign." };
  }

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .insert({ campaign_id: campaign.id, status: "active" })
    .select("id")
    .single();

  if (sessionError || !session) {
    return { error: sessionError?.message ?? "Could not create the demo session." };
  }

  const { data: characters, error: characterError } = await supabase
    .from("characters")
    .insert(
      CAST.map((entry) => ({
        campaign_id: campaign.id,
        owner_id: user.id,
        name: entry.name,
        class: entry.class,
        level: entry.level,
        sheet: entry.sheet,
      })),
    )
    .select("id, name");

  if (characterError || !characters) {
    return { error: characterError?.message ?? "Could not create the demo party." };
  }

  const idOf = (key: (typeof CAST)[number]["key"]) => {
    const name = CAST.find((entry) => entry.key === key)!.name;
    return characters.find((row) => row.name === name)!.id as string;
  };

  // Use the real compendium row, so the cast event points at a spell that
  // actually exists rather than a plausible-looking uuid.
  const { data: spell } = await supabase
    .from("spells")
    .select("id, name")
    .eq("name", "Thunderwave")
    .maybeSingle();

  if (!spell) {
    return {
      error:
        "The spell compendium looks empty — run supabase/migrations/0009_spells.sql before seeding.",
    };
  }

  const events = buildEncounter(session.id, idOf, { id: spell.id, name: spell.name });

  // One batch insert: the before-insert trigger assigns `seq` per row and
  // Postgres processes a multi-row INSERT in order, so the log comes out in
  // narrative order without 60 sequential round-trips.
  const { error: eventsError } = await supabase.from("events").insert(events);
  if (eventsError) {
    return { error: eventsError.message };
  }

  revalidatePath("/dm", "layout");
  revalidatePath("/play", "layout");
  redirect(`/dm?campaign=${campaign.id}`);
}

function buildEncounter(
  sessionId: string,
  idOf: (key: (typeof CAST)[number]["key"]) => string,
  spell: { id: string; name: string },
): EventRow[] {
  const events: EventRow[] = [];

  const push = (
    type: string,
    payload: Record<string, unknown>,
    visibility = "public",
    proposedBy = "human",
  ) => {
    events.push({
      id: newEventId(),
      session_id: sessionId,
      type,
      actor: null,
      payload,
      visibility,
      proposed_by: proposedBy,
    });
  };

  const narrate = (text: string) => push("narration", { v: 1, text });

  for (const { cell, terrainType, destructible } of buildTerrain()) {
    push("terrain", { v: 1, cell, terrainType, destructible });
  }

  narrate(
    "The stair ends at a slab of black basalt, already ajar. Beyond it the air is cold and tastes of old smoke — a burial chamber, braziers still guttering after however many centuries, and a sarcophagus split open along its length.",
  );

  // Everyone starts at the origin until their first move event.
  for (const entry of CAST) {
    push("move", {
      v: 1,
      actorId: idOf(entry.key),
      from: { x: 0, y: 0 },
      to: entry.at,
      feetSpent: 0,
      feetRemaining: entry.sheet.speed,
    });
  }

  push("round", { v: 1, number: 1, phase: "start" });

  narrate(
    "Ash lifts off the floor in a slow spiral, and the thing in the sarcophagus sits up. It is a man's shape packed with embers, and where it looks, the braziers flare.",
  );

  // Real seeded dice, same as proposeAttackEvent — the log's numbers are
  // auditable rather than decorative, so a demo attack is a real attack.
  pushAttack(push, idOf("rowan"), idOf("wight"), 6, 15);
  push("damage", {
    v: 1,
    targetId: idOf("wight"),
    amount: 13,
    damageType: "slashing",
    source: "Rowan's greataxe",
  });

  narrate("Sera plants her feet and the chant lands like a dropped anvil.");
  push("cast", {
    v: 1,
    spellId: spell.id,
    spellName: spell.name,
    casterId: idOf("sera"),
    targetIds: [idOf("wight")],
    slotLevel: 1,
    concentration: false,
  });
  push("damage", {
    v: 1,
    targetId: idOf("wight"),
    amount: 9,
    damageType: "thunder",
    source: "Thunderwave",
  });

  push("destroy", { v: 1, cell: { x: 5, y: 6 }, cause: "the blast throws a reliquary chest apart" });

  pushAttack(push, idOf("wight"), idOf("rowan"), 4, 14);
  push("damage", {
    v: 1,
    targetId: idOf("rowan"),
    amount: 11,
    damageType: "fire",
    source: "cinder-wreathed claw",
  });
  push("condition", {
    v: 1,
    targetId: idOf("rowan"),
    condition: "frightened",
    action: "apply",
    durationRounds: 2,
    source: "Cinder Wight",
  });

  pushAttack(push, idOf("thane"), idOf("wight"), 5, 15);
  push("damage", {
    v: 1,
    targetId: idOf("thane"),
    amount: 5,
    damageType: "fire",
    source: "standing too close to a brazier",
  });

  // A hidden beat the DM can hand to the table with the log's Reveal button.
  push(
    "narration",
    { v: 1, text: "The sarcophagus lid is carved on the underside — a second name, scratched out." },
    "dm_only",
  );

  push("reveal", {
    v: 1,
    targetEventId: null,
    area: null,
    toVisibility: "public",
    description: "Scratched into the sarcophagus lid: a second name, deliberately effaced.",
  });

  push("round", { v: 1, number: 1, phase: "end" });
  push("round", { v: 1, number: 2, phase: "start" });

  narrate("It is still standing. The embers under its ribs are burning brighter.");

  return events;
}

function pushAttack(
  push: (type: string, payload: Record<string, unknown>) => void,
  attackerId: string,
  targetId: string,
  modifier: number,
  targetAc: number,
) {
  const { rolls, seed } = rollDice(20, 1);
  const roll = rolls[0];
  const total = roll + modifier;
  const critical = roll === 20;
  const hit = roll === 1 ? false : critical ? true : total >= targetAc;

  push("attack", {
    v: 1,
    attackerId,
    targetId,
    roll,
    rawRolls: rolls,
    seed,
    modifier,
    total,
    targetAc,
    advantage: "normal",
    critical,
    hit,
  });
}
