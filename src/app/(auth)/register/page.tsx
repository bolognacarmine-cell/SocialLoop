import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getSession } from "@/lib/auth/session";

export const metadata = { title: "Registrati" };

export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <AuthForm mode="register" />
    </main>
  );
}
