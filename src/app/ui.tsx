import type { ReactNode } from "react";
import { DISCLAIMER, EMISSIONS } from "../lib/config";

export const Card = ({ title, right, children, className = "" }: { title?: string; right?: ReactNode; children: ReactNode; className?: string }) => (
  <section className={`rounded-3xl border border-white/5 bg-card p-4 sm:p-5 ${className}`}>
    {(title || right) && (
      <div className="mb-3 flex items-center justify-between gap-2">
        {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
        {right}
      </div>
    )}
    {children}
  </section>
);

export const PageTitle = ({ children, sub }: { children: ReactNode; sub?: string }) => (
  <div className="mb-5"><h1 className="text-3xl font-semibold tracking-tight">{children}</h1>{sub && <p className="mt-1 text-sm text-mute">{sub}</p>}</div>
);

const tones: Record<string, string> = {
  green: "bg-brand/15 text-brand", blue: "bg-brand2/15 text-brand2", amber: "bg-warn/15 text-warn", red: "bg-bad/15 text-bad", gray: "bg-white/10 text-mute",
};
export const Badge = ({ tone = "gray", children }: { tone?: keyof typeof tones | string; children: ReactNode }) => (
  <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone] ?? tones.gray}`}>{children}</span>
);

export const statusTone = (s: string) => ({ validated: "green", succeeded: "green", approved: "green", resolved: "green", needs_review: "amber", pending: "amber", processing: "blue", queued: "blue", running: "blue", rejected: "red", failed: "red", active: "amber", dismissed: "gray" } as Record<string, string>)[s] ?? "gray";
export const Status = ({ s }: { s: string }) => <Badge tone={statusTone(s)}>{s.replace("_", " ")}</Badge>;

export const DataTag = ({ t }: { t: string }) => (
  <Badge tone={t === "measured" ? "green" : t === "user_entered" ? "blue" : "amber"}>{t}</Badge>
);

export const Disclaimer = () => <p className="mt-3 text-xs text-warn">{DISCLAIMER}.</p>;

export const FactorNote = () => (
  <p className="mt-2 text-xs text-mute">
    Grid factor: {EMISSIONS.grid_electricity.value} kg CO2e/kWh ({EMISSIONS.grid_electricity.factor_type}, {EMISSIONS.grid_electricity.basis}) · Source: {EMISSIONS.grid_electricity.source.name} · Data year {EMISSIONS.grid_electricity.data_year} (not live). Petrol: {EMISSIONS.petrol.value} kg CO2/L ({EMISSIONS.petrol.basis.replace(/_/g, " ")}). Basis differs between the two, so avoided figures are rough estimates.
  </p>
);

export const Btn = ({ children, kind = "primary", ...p }: { children: ReactNode; kind?: "primary" | "ghost" | "danger" } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button {...p} className={`min-h-11 rounded-full px-5 py-2 text-sm font-semibold transition active:scale-95 ${
    kind === "primary" ? "bg-brand text-black hover:brightness-110"
    : kind === "danger" ? "bg-bad/15 text-bad hover:bg-bad/25" : "bg-card2 text-ink hover:bg-white/10"} ${p.className ?? ""}`}>{children}</button>
);

export const Field = ({ label, children }: { label: string; children: ReactNode }) => <div><label>{label}</label>{children}</div>;

export const Empty = ({ children }: { children: ReactNode }) => <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-mute">{children}</p>;

export const Notice = ({ error, ok }: { error?: string; ok?: string }) =>
  error ? <p className="mb-4 rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm text-bad">{error}</p>
  : ok ? <p className="mb-4 rounded-xl border border-brand/40 bg-brand/10 p-3 text-sm text-brand">{ok}</p> : null;

import { Icon } from "./icons";

export const Stat = ({ icon, label, value, sub, className = "" }: { icon: string; label: string; value: ReactNode; sub?: ReactNode; className?: string }) => (
  <div className={`rounded-3xl border border-white/5 bg-card p-4 ${className}`}>
    <div className="flex items-center gap-2 text-xs text-mute"><span className="grid h-7 w-7 place-items-center rounded-lg bg-brand/15 text-brand"><Icon n={icon} className="h-4 w-4" /></span>{label}</div>
    <div className="mt-2 text-2xl font-semibold">{value}</div>
    {sub && <div className="mt-1 text-xs text-mute">{sub}</div>}
  </div>
);

export const Ring = ({ pct, label, sub }: { pct: number; label: string; sub?: string }) => {
  const r = 42, c = 2 * Math.PI * r, o = c * (1 - Math.min(100, pct) / 100);
  return (
    <div className="relative grid h-32 w-32 place-items-center">
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#2b3035" strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="#3df07a" strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={o} />
      </svg>
      <div className="text-center"><div className="text-xl font-semibold">{label}</div>{sub && <div className="text-[10px] text-mute">{sub}</div>}</div>
    </div>
  );
};

export const Bars = ({ data }: { data: { label: string; value: number }[] }) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  const top = data.findIndex((d) => d.value === max);
  return (
    <div className="flex h-28 items-end gap-2">
      {data.map((d, i) => (
        <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
          <div className={`w-full rounded-lg ${i === top ? "bg-brand" : "bg-brand/30"}`} style={{ height: `${Math.max(8, (d.value / max) * 100)}%` }} title={`${d.value} kWh`} />
          <span className="text-[10px] text-mute">{d.label}</span>
        </div>
      ))}
    </div>
  );
};
