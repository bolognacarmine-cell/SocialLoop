import type { Metadata } from "next";
import "./globals.css";

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
  return (
    <html lang="it">
      <body className="min-h-screen bg-slate-50">{children}</body>
    </html>
  );
}
