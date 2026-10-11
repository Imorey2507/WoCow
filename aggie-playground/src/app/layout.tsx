import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { ActivitiesProvider } from "@/components/ActivitiesProvider";
import { AppShell } from "@/components/AppShell";

// Self-hosted variable fonts (from npm) so builds never depend on reaching Google Fonts.
const fredoka = localFont({
  src: "../../node_modules/@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2",
  variable: "--font-fredoka",
  weight: "300 700",
  display: "swap",
});
const nunito = localFont({
  src: "../../node_modules/@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2",
  variable: "--font-nunito",
  weight: "200 1000",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aggie Playground — what's happening on campus",
  description: "Discover what's happening around UC Davis, join spontaneous activities, and meet your people.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Aggie Playground", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#ffd84d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AuthProvider>
          <ActivitiesProvider>
            <AppShell>{children}</AppShell>
          </ActivitiesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
