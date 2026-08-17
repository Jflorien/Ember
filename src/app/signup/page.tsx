import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { OAuthButtons } from "@/components/oauth-buttons";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Join the private alpha and pull up a chair."
    >
      <OAuthButtons />

      <div className="my-6 flex items-center gap-4">
        <div className="h-px flex-1 bg-basalt-700" />
        <span className="runic">or</span>
        <div className="h-px flex-1 bg-basalt-700" />
      </div>

      <SignupForm />

      <p className="mt-8 text-center text-sm text-ash-300">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-forge-500 hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
