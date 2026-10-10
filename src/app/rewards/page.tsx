import { Card, PageTitle, Btn, Notice, Badge } from "../ui";
import { db } from "../../lib/db";
import { pointsBalance } from "../../lib/queries";
import { REWARDS, POINTS } from "../../lib/config";
import { redeem } from "../actions";

export const dynamic = "force-dynamic";

export default async function Rewards({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { error, ok } = await searchParams;
  const bal = pointsBalance();
  const ledger = db().prepare("SELECT * FROM points_ledger ORDER BY id DESC LIMIT 20").all() as { id: number; points: number; reason: string; created_at: string }[];
  return (
    <>
      <PageTitle sub="Points are earned only for validated, evidence-backed actions. Never for opening the app or driving.">EcoPoints and rewards</PageTitle>
      <Notice error={error} ok={ok ? "Redeemed. Demo reward - simulated." : undefined} />
      <Card title="Balance"><p className="text-4xl font-bold text-brand">{bal}</p></Card>
      <div className="mt-4 grid gap-4 ">
        <Card title="Rewards catalogue" right={<Badge tone="amber">Demo reward - simulated</Badge>}>
          <ul className="space-y-3">
            {REWARDS.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-2xl bg-card2 p-3">
                <div><p className="font-medium">{r.name}</p><p className="text-xs text-mute">{r.kind} · {r.cost} pts · Demo reward - simulated</p></div>
                <form action={redeem}><input type="hidden" name="id" value={r.id} /><Btn kind={bal >= r.cost ? "primary" : "ghost"} disabled={bal < r.cost}>Redeem</Btn></form>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Points ledger">
          <ul className="space-y-2 text-sm">
            {ledger.map((l) => (
              <li key={l.id} className="flex justify-between gap-3 border-b border-line pb-2"><span>{l.reason}<span className="block text-xs text-mute">{l.created_at}</span></span><span className={l.points > 0 ? "font-semibold text-brand" : l.points < 0 ? "font-semibold text-bad" : "text-mute"}>{l.points > 0 ? "+" : ""}{l.points}</span></li>
            ))}
          </ul>
        </Card>
      </div>
      <Card title="Point values and monthly caps" className="mt-4">
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-mute"><tr><th className="py-1">Activity</th><th>With evidence</th><th>Without</th><th>Cap / month</th></tr></thead>
          <tbody>{Object.entries(POINTS).map(([k, p]) => <tr key={k} className="border-t border-line"><td className="py-2">{p.label}</td><td>{p.evidence}</td><td>{p.noEvidence}</td><td>{p.capPerMonth}</td></tr>)}</tbody></table></div>
        <p className="mt-2 text-xs text-mute">Duplicates, needs-review and rejected entries earn 0 points.</p>
      </Card>
    </>
  );
}
