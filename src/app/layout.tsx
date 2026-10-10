import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { Icon } from "./icons";

export const metadata: Metadata = { title: "Kivora EV EcoPilot", description: "Trustworthy battery history and estimated climate impact for EV owners in Pakistan.", manifest: "/manifest.webmanifest" };
export const viewport: Viewport = { themeColor: "#0e1012", width: "device-width", initialScale: 1 };

const TOP = [["/rewards", "gift", "Rewards"], ["/report", "doc", "Report"], ["/settings", "gear", "Settings"]];
const NAV = [["/", "home", "Home"], ["/passport", "passport", "Passport"], ["/upload", "plus", "Upload"], ["/ledger", "ledger", "Ledger"], ["/agent", "bolt", "Agent"]];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="mx-auto flex max-w-xl items-center justify-between px-4 pt-4">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Kivora" className="h-10 w-10 rounded-2xl bg-white" />
            <span className="text-lg font-semibold leading-tight">Kivora <span className="text-brand">EcoPilot</span></span>
          </Link>
          <div className="flex gap-2">
            {TOP.map(([h, i, l]) => (
              <Link key={h} href={h} aria-label={l} title={l} className="grid h-10 w-10 place-items-center rounded-full bg-card2 text-mute hover:text-brand"><Icon n={i} /></Link>
            ))}
          </div>
        </header>
        <main className="mx-auto max-w-xl px-4 pb-32 pt-6">{children}
          <p className="mt-8 text-center text-xs text-mute">Estimates only, not certified carbon savings. Rewards are demo only.</p>
        </main>
        <nav className="fixed inset-x-0 bottom-4 z-30 mx-auto flex w-[calc(100%-2rem)] max-w-sm items-center justify-between rounded-full border border-white/10 bg-[#15181a]/95 p-2 shadow-2xl backdrop-blur">
          {NAV.map(([h, i, l]) => (
            <Link key={h} href={h} aria-label={l} className={`grid h-12 w-12 place-items-center rounded-full ${i === "plus" ? "bg-brand text-black glow-green" : "text-mute hover:text-ink"}`}><Icon n={i} className="h-6 w-6" /></Link>
          ))}
        </nav>
      </body>
    </html>
  );
}
