import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getSession } from "@/lib/auth/session";

export const metadata = { title: "Accedi" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <AuthForm mode="login" />
    </main>
  );
}
