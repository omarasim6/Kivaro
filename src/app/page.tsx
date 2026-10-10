import Link from "next/link";
import { db, getSetting } from "../lib/db";
import { Card, DataTag, Disclaimer, Btn, Empty, FactorNote, Stat, Ring, Bars } from "./ui";
import { Timeline } from "./parts";
import { CarArt, Icon } from "./icons";
import { getVehicle, getEntries, pointsBalance, ledgerSummary, goalProgress, thisMonth } from "../lib/queries";
import { ollamaHealth } from "../lib/ai";
import { setAlert, runNow } from "./actions";
import { REWARDS } from "../lib/config";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const v = getVehicle();
  const month = thisMonth();
  const s = ledgerSummary(month);
  const alerts = db().prepare("SELECT * FROM alerts WHERE status='active' ORDER BY id DESC").all() as { id: number; kind: string; message: string }[];
  const goal = goalProgress(month);
  const paused = getSetting("paused") === "1";
  const last = getSetting("last_run");
  const queued = (db().prepare("SELECT COUNT(*) c FROM jobs WHERE status IN ('queued','running')").get() as { c: number }).c;
  const validated = (db().prepare("SELECT COUNT(*) c FROM entries WHERE status='validated'").get() as { c: number }).c;
  const health = await ollamaHealth();
  const kg = s.get("charging_emissions_kg"), av = s.get("avoided_kg"), kwh = s.get("energy_kwh");
  const bal = pointsBalance();
  const next = REWARDS.map((r) => r.cost).sort((a, b) => a - b).find((c) => c > bal) ?? REWARDS[REWARDS.length - 1].cost;
  const sessions = (db().prepare("SELECT date, kwh FROM charging_sessions ORDER BY date DESC, id DESC LIMIT 7").all() as { date: string; kwh: number }[]).reverse();
  const bars = sessions.map((x) => ({ label: x.date.slice(8), value: x.kwh }));

  return (
    <>
      <div className="mb-2">
        <p className="text-4xl font-light text-mute">Welcome back!</p>
        <p className="text-3xl font-semibold leading-tight">Manage your {v.make} {v.model}&apos;s battery care here</p>
        <p className="mt-1 text-sm text-mute">{v.plate} · {v.battery_kwh} kWh · {v.odometer_km.toLocaleString()} km</p>
      </div>

      <div className="relative mt-4 overflow-hidden rounded-3xl border border-white/5 bg-card p-5">
        <div className="flex items-end justify-between">
          <div><p className="text-xs text-mute">EcoPoints</p><p className="text-7xl font-light leading-none">{bal}</p></div>
          <p className="pb-2 text-xs text-mute">next reward at {next}</p>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-card2"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (bal / next) * 100)}%` }} /></div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-xl bg-card2 p-2"><p className="text-mute">Valid records</p><p className="text-sm font-semibold">{validated}</p></div>
          <div className="rounded-xl bg-card2 p-2"><p className="text-mute">Alerts</p><p className="text-sm font-semibold">{alerts.length}</p></div>
          <div className="rounded-xl bg-card2 p-2"><p className="text-mute">Month kWh</p><p className="text-sm font-semibold">{kwh.toFixed(0)}</p></div>
        </div>
        <div className="-mb-3 mt-4"><CarArt /></div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-full bg-card p-2 pl-5">
        <div className="text-sm"><span className={`mr-2 inline-block h-2 w-2 rounded-full ${paused ? "bg-warn" : "bg-brand"}`} />Agent {paused ? "paused" : "running"} · {queued} queued
          <span className="block text-[11px] text-mute">Last run {last ? new Date(last).toLocaleTimeString() : "never"} · AI {health.reachable ? "online" : "offline (cached/manual)"}</span></div>
        <form action={runNow}><Btn>Run now</Btn></form>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat icon="leaf" label="Charging CO2e" value={<>{kg.toFixed(1)}<span className="text-sm text-mute"> kg</span></>} sub={<DataTag t="model_estimated" />} />
        <Stat icon="route" label="Avoided vs petrol" value={<>{av.toFixed(1)}<span className="text-sm text-mute"> kg</span></>} sub={<DataTag t="model_estimated" />} />
      </div>
      <Stat className="mt-3" icon="bolt" label="Energy this month" value={<>{kwh.toFixed(1)} <span className="text-sm text-mute">kWh</span></>}
        sub={<span className="flex gap-1"><DataTag t="measured" /><DataTag t="user_entered" /></span>} />

      <Card title="Charging energy (last sessions)" className="mt-3"><Bars data={bars} /></Card>

      <Card title="Monthly goal" className="mt-3">
        <div className="flex items-center gap-4">
          <Ring pct={goal.pct} label={`${goal.pct}%`} sub="of goal" />
          <div className="text-sm"><p>{goal.label}</p><p className="mt-1 text-xs text-mute">{goal.text}</p><Link href="/ledger" className="mt-2 inline-block text-xs text-brand">Change goal →</Link></div>
        </div>
      </Card>

      <Card title="Active alerts" className="mt-3">
        {alerts.length === 0 ? <Empty>No active alerts. Your battery history looks consistent.</Empty> : (
          <ul className="space-y-3">
            {alerts.map((a) => (
              <li key={a.id} className="rounded-2xl bg-warn/10 p-3 text-sm">
                <div className="flex items-center gap-2 text-warn"><Icon n="alert" className="h-4 w-4" /><span className="text-xs font-medium">{a.kind.replace(/_/g, " ")}</span></div>
                <p className="mt-1">{a.message}</p>
                <div className="mt-2 flex gap-2">
                  {(["resolved", "dismissed"] as const).map((st) => (
                    <form key={st} action={setAlert}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="status" value={st} /><Btn kind="ghost" className="!min-h-8 !px-4 !py-1 !text-xs">{st === "resolved" ? "Resolve" : "Dismiss"}</Btn></form>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Emission assumptions" className="mt-3"><FactorNote /><Disclaimer /></Card>

      <Card title="Latest timeline entries" className="mt-3" right={<Link href="/passport" className="text-xs text-brand">All →</Link>}>
        <Timeline entries={getEntries(3)} actions={false} />
      </Card>
      
    </>
  );
}
