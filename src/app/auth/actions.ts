"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AuthState = {
  error?: string;
  success?: string;
};

export async function signIn(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/dm");
}

export async function signUp(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "");
  const terms = formData.get("terms");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  if (!displayName.trim()) {
    return { error: "Please enter a display name." };
  }

  if (!terms) {
    return { error: "You must accept the terms to continue." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
    },
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/login?confirmed=1");
}

export async function requestPasswordReset(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");

  if (!email) {
    return { error: "Enter your email address." };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/login`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: "Check your email for a password reset link." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

/**
 * Supabase emails a confirmation link to the *new* address and only swaps it
 * once that's clicked — so this reports "check your email," not "done."
 * (This project currently has Confirm email switched off on the live Supabase
 * project to unblock local testing, in which case it takes effect
 * immediately; the copy stays accurate either way by not promising which.)
 */
export async function updateEmail(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Enter a new email address." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  if (user.email === email) {
    return { error: "That's already your email address." };
  }

  const { error } = await supabase.auth.updateUser({ email });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/play/account");
  return { success: "Check the new address for a confirmation link." };
}

/**
 * Supabase's updateUser doesn't require the current password — an open
 * session is enough. That means a borrowed unlocked laptop could silently
 * change the password, so this re-authenticates first and treats a failed
 * sign-in as a wrong current password.
 */
export async function updatePassword(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword) {
    return { error: "Enter your current and new password." };
  }
  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "New passwords don't match." };
  }
  if (newPassword === currentPassword) {
    return { error: "New password must be different from the current one." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Not signed in." };

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (reauthError) {
    return { error: "Current password is incorrect." };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    return { error: error.message };
  }

  return { success: "Password updated." };
}

export type ExportState = {
  error?: string;
  /** JSON payload, handed to the browser as a download by the client component. */
  data?: string;
};

/**
 * GDPR art. 20 (portability): everything this account owns or can see, as
 * one JSON file. Reads go through the normal authenticated client, so RLS
 * decides what's included — a player's export can't leak another table's
 * dm_only events just because the export ran server-side.
 */
export async function exportMyData(): Promise<ExportState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const [profile, campaigns, memberships, characters, events] = await Promise.all([
    supabase.from("users").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("campaigns").select("*").eq("owner_id", user.id),
    supabase.from("memberships").select("*").eq("user_id", user.id),
    supabase.from("characters").select("*").eq("owner_id", user.id),
    supabase.from("events").select("*").order("committed_at", { ascending: true }),
  ]);

  const firstError =
    profile.error ?? campaigns.error ?? memberships.error ?? characters.error ?? events.error;
  if (firstError) {
    return { error: firstError.message };
  }

  return {
    data: JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        account: { id: user.id, email: user.email, createdAt: user.created_at },
        profile: profile.data,
        campaignsIOwn: campaigns.data ?? [],
        memberships: memberships.data ?? [],
        characters: characters.data ?? [],
        // Every event this account is allowed to read, per RLS — not only
        // its own, since a shared session log is jointly authored.
        visibleEvents: events.data ?? [],
      },
      null,
      2,
    ),
  };
}

/**
 * GDPR art. 17 (erasure). Calls delete_my_account() (0012), which deletes
 * the caller's auth.users row; everything else cascades from there —
 * including any campaign this account owns, and every session and event
 * inside it. The UI warns about owned campaigns before getting here.
 */
export async function deleteMyAccount(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const confirmation = String(formData.get("confirmation") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Not signed in." };

  if (confirmation.toLowerCase() !== user.email.toLowerCase()) {
    return { error: "Type your email address exactly to confirm deletion." };
  }

  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    return { error: error.message };
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/?deleted=1");
}

export async function signInWithOAuth(provider: "discord" | "google") {
  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${siteUrl}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  if (data.url) {
    redirect(data.url);
  }
}
