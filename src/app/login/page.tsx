import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { OAuthButtons } from "@/components/oauth-buttons";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; confirmed?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to reach your table."
    >
      {params.confirmed && (
        <p className="mb-6 border-l-2 border-verdant bg-verdant/10 px-4 py-3 text-sm text-verdant">
          Check your email to confirm your account, then log in.
        </p>
      )}

      <OAuthButtons />

      <div className="my-6 flex items-center gap-4">
        <div className="h-px flex-1 bg-basalt-700" />
        <span className="runic">or</span>
        <div className="h-px flex-1 bg-basalt-700" />
      </div>

      <LoginForm initialError={params.error} />

      <p className="mt-8 text-center text-sm text-ash-300">
        Don&rsquo;t have an account?{" "}
        <Link href="/signup" className="font-medium text-forge-500 hover:underline">
          Sign up
        </Link>
      </p>
    </AuthShell>
  );
}
