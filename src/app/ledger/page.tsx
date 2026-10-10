import { Card, PageTitle, Btn, Field, Notice, DataTag, Disclaimer, FactorNote, Empty } from "../ui";
import { db, getSetting } from "../../lib/db";
import { ledgerSummary, getVehicle, goalProgress, thisMonth } from "../../lib/queries";
import { addCharging, setGoal } from "../actions";
import { EMISSIONS } from "../../lib/config";

export const dynamic = "force-dynamic";

export default async function Ledger({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const v = getVehicle();
  const month = thisMonth();
  const enabled = getSetting("perm_charging") === "1";
  const all = ledgerSummary();
  const types = ["measured", "user_entered", "model_estimated"] as const;
  const sessions = db().prepare("SELECT * FROM charging_sessions ORDER BY date DESC, id DESC LIMIT 15").all() as { id: number; date: string; kwh: number; cost: number | null; distance_km: number; data_source_type: string }[];
  const goal = goalProgress(month);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <PageTitle sub="Every figure is tagged measured, user entered, or model estimated.">Impact Ledger</PageTitle>
      <Notice error={error} />
      {!enabled && <p className="mb-4 rounded-xl border border-warn/30 bg-warn/10 p-3 text-sm text-warn">Charging data access is turned off for the agent (Agent Controls). Figures below are hidden.</p>}
      {enabled && (
        <div className="grid gap-4 ">
          {types.map((t) => {
            const rows = all.rows.filter((r) => r.t === t);
            return (
              <Card key={t} title={t.replace("_", " ")} right={<DataTag t={t} />}>
                {rows.length === 0 ? <p className="text-sm text-mute">Nothing yet.</p> : (
                  <ul className="space-y-1 text-sm">
                    {rows.map((r) => (
                      <li key={r.kind} className="flex justify-between gap-2"><span className="text-mute">{r.kind.replace(/_/g, " ")}</span><span className="font-semibold">{r.v.toFixed(r.unit === "action" ? 0 : 1)} {r.unit}</span></li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
      <Card title="How these are calculated" className="mt-4">
        <ul className="list-disc space-y-1 pl-5 text-sm text-mute">
          <li>Charging emissions = kWh × {EMISSIONS.grid_electricity.value} kg CO2e/kWh</li>
          <li>Avoided = distance × (petrol {EMISSIONS.petrol.value} kg/L ÷ {v.cmp_km_per_litre} km/L) − charging emissions</li>
          <li>Comparison vehicle: {v.cmp_label}, {v.cmp_fuel}, {v.cmp_km_per_litre} km/L</li>
          <li>All math is plain code. The LLM never calculates.</li>
        </ul>
        <FactorNote /><Disclaimer />
      </Card>
      <div className="mt-4 grid gap-4 ">
        <Card title="Log a charging session">
          <form action={addCharging} className="space-y-3">
            <Field label="Date"><input type="date" name="date" defaultValue={today} required /></Field>
            <Field label="Energy (kWh)"><input type="number" step="0.1" min="0.1" name="kwh" required /></Field>
            <Field label="Distance driven on this charge (km, optional)"><input type="number" name="distance_km" min="0" /></Field>
            <Field label="Cost (PKR, optional)"><input type="number" name="cost" min="0" /></Field>
            <Field label="Data source"><select name="source"><option value="user_entered">user entered</option><option value="measured">measured (from charger/app)</option></select></Field>
            <Btn>Save session</Btn>
          </form>
        </Card>
        <Card title="Monthly goal">
          <form action={setGoal} className="space-y-3">
            <Field label="Goal type"><select name="goal_type" defaultValue={goal.type}><option value="actions">Log N validated maintenance actions</option><option value="intensity">Keep estimated emissions per km below N g</option></select></Field>
            <Field label="Target (N)"><input type="number" name="goal_target" defaultValue={goal.target} min="1" /></Field>
            <Btn kind="ghost">Save goal</Btn>
          </form>
          <p className="mt-3 text-sm text-mute">{goal.text}</p>
        </Card>
      </div>
      <Card title="Recent charging sessions" className="mt-4">
        {sessions.length === 0 ? <Empty>No charging sessions yet.</Empty> : (
          <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead className="text-mute"><tr><th className="py-1">Date</th><th>kWh</th><th>km</th><th>PKR</th><th>Source</th></tr></thead>
            <tbody>{sessions.map((s) => <tr key={s.id} className="border-t border-line"><td className="py-2">{s.date}</td><td>{s.kwh}</td><td>{s.distance_km || "-"}</td><td>{s.cost ?? "-"}</td><td><DataTag t={s.data_source_type} /></td></tr>)}</tbody>
          </table></div>
        )}
      </Card>
    </>
  );
}
