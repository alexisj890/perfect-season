import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import Link from "next/link";
import { HeaderAccount } from "@/components/HeaderAccount";
import { SettingsMenu } from "@/components/SettingsMenu";
import { ThemeToggle, THEME_SCRIPT } from "@/components/ThemeToggle";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-barlow",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

// Only used for the big "35–0" on the landing page.
const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  weight: "800",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Perfect Season",
  description: "Draft an all-time XI and chase a perfect 35–0 season.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="night"
      suppressHydrationWarning
      className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <head>
        {/* Applies the saved day/night theme before the first paint, so there's no flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <header>
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-8">
            <Link href="/" className="text-lg font-bold tracking-tight">
              Perfect <span className="text-accent">Season</span>
            </Link>
            <div className="flex items-center gap-4">
              <HeaderAccount />
              <SettingsMenu />
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-8 py-8">{children}</main>
      </body>
    </html>
  );
}
