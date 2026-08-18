"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicEnv } from "@/lib/ai/env";
import { NARRATION_COPILOT_SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { describeEvent } from "@/lib/events";

export type SuggestNarrationState = {
  suggestion?: string;
  error?: string;
};

const RECENT_EVENTS_LIMIT = 20;
const MODEL = "claude-sonnet-5";

/**
 * Never commits anything — the co-pilot only drafts. The human DM decides
 * whether to send the suggestion as-is (proposed_by: "model") or edit it
 * first (proposed_by: "human"); that choice happens in the UI, not here.
 */
export async function suggestNarration(
  sessionId: string,
  _prevState: SuggestNarrationState,
  formData: FormData,
): Promise<SuggestNarrationState> {
  const prompt = String(formData.get("prompt") ?? "").trim();
  if (!prompt) {
    return { error: "Tell the co-pilot what to narrate." };
  }

  let apiKey: string;
  try {
    ({ apiKey } = getAnthropicEnv());
  } catch (envError) {
    return {
      error: envError instanceof Error ? envError.message : "AI co-pilot isn't configured.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("type, payload")
    .eq("session_id", sessionId)
    .order("seq", { ascending: false })
    .limit(RECENT_EVENTS_LIMIT);

  if (error) {
    return { error: error.message };
  }

  const recentLog = (data ?? [])
    .reverse()
    .map((event) =>
      describeEvent(event as { type: string; payload: Record<string, unknown> }),
    )
    .join("\n");

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: NARRATION_COPILOT_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Recent event log (oldest to newest):\n${recentLog || "(nothing has happened yet)"}\n\nWhat the DM wants narrated: ${prompt}`,
        },
      ],
    });

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!text) {
      return { error: "The co-pilot didn't return anything usable — try again." };
    }

    return { suggestion: text };
  } catch (apiError) {
    return {
      error: apiError instanceof Error ? apiError.message : "The AI co-pilot request failed.",
    };
  }
}
