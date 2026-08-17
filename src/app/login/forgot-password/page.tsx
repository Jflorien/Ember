import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll send you a link to get back into your account."
    >
      <ForgotPasswordForm />

      <p className="mt-8 text-center text-sm text-ash-300">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-forge-500 hover:underline">
          Back to log in
        </Link>
      </p>
    </AuthShell>
  );
}
