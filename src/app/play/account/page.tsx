import { createClient } from "@/lib/supabase/server";
import { getMyDmCampaigns } from "@/app/dm/actions";
import {
  EmailForm,
  PasswordForm,
  DataExportPanel,
  DeleteAccountForm,
} from "@/components/account-forms";

export const dynamic = "force-dynamic";

/**
 * Account settings — auth (email, password) and the two GDPR rights that
 * need a real implementation rather than a policy page: portability (art. 20,
 * export) and erasure (art. 17, delete). Owned campaigns are fetched here
 * purely to warn about the delete cascade: erasing this account takes every
 * campaign it DMs with it.
 */
export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    // Middleware already gates /play/*, so this is belt-and-braces for the
    // window where a session expires mid-navigation.
    return <p className="font-mono text-sm text-ash-500">Not signed in.</p>;
  }

  const ownedCampaigns = await getMyDmCampaigns();

  const providers =
    (user.app_metadata?.providers as string[] | undefined) ??
    (user.app_metadata?.provider ? [user.app_metadata.provider as string] : []);
  const isPasswordAccount = providers.includes("email");

  return (
    <>
      <div>
        <span className="runic hot">Account</span>
        <h1 className="font-display mt-4 text-2xl font-bold tracking-tight text-ash-050">
          Your account, your data.
        </h1>
      </div>

      <div className="plate flex flex-col gap-2 p-6">
        <span className="runic">Signed in as</span>
        <span className="font-mono text-sm text-ash-100">{user.email}</span>
        <span className="font-mono text-xs text-ash-500">
          Since {new Date(user.created_at).toLocaleDateString()} · via{" "}
          {providers.length > 0 ? providers.join(", ") : "email"}
        </span>
      </div>

      <EmailForm currentEmail={user.email} />

      {isPasswordAccount ? (
        <PasswordForm />
      ) : (
        <div className="plate flex flex-col gap-2 p-6">
          <span className="runic">Password</span>
          <p className="text-sm text-ash-300">
            This account signs in through {providers.join(", ")}, so there&rsquo;s no Ember
            password to change — manage it with that provider.
          </p>
        </div>
      )}

      <DataExportPanel />

      <DeleteAccountForm
        email={user.email}
        ownedCampaigns={ownedCampaigns.map((campaign) => campaign.name)}
      />
    </>
  );
}
