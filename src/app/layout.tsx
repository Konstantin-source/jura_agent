import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { RuntimeProvider } from "@/components/runtime-provider";

export const metadata: Metadata = {
  title: { default: "Jura Agent", template: "%s · Jura Agent" },
  description: "Dein präziser Lernassistent für das deutsche Jurastudium.",
  applicationName: "Jura Agent",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5f3ed",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>
        <RuntimeProvider>
          <AppShell>{children}</AppShell>
        </RuntimeProvider>
      </body>
    </html>
  );
}
