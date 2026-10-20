import type { Metadata } from "next";
import "./globals.css";
import { ensureEmbeddedWorker } from "@/lib/worker/embedded";

export const metadata: Metadata = {
  title: {
    default: "SocialLoop",
    template: "%s · SocialLoop"
  },
  description:
    "SocialLoop: pubblica sui social, costruisci funnel con landing page, CRM e automazioni.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Belt and braces: the health route is the primary trigger (Render polls it),
  // this covers the case where no request has arrived yet.
  void ensureEmbeddedWorker();

  return (
    <html lang="it">
      <body className="min-h-screen bg-slate-50">{children}</body>
    </html>
  );
}
