import { Card, DataTag, Disclaimer, FactorNote } from "./ui";
import { Timeline } from "./parts";
import { getEntries, getVehicle, ledgerSummary } from "../lib/queries";
import { EMISSIONS } from "../lib/config";

export function ReportBody({ publicToken }: { publicToken?: string }) {
  const v = getVehicle();
  const s = ledgerSummary();
  const types = ["measured", "user_entered", "model_estimated"];
  return (
    <div className="space-y-4">
      <Card title="Vehicle"><p className="text-sm">{v.make} {v.model} {v.year} · {v.plate} · battery {v.battery_kwh} kWh · odometer {v.odometer_km.toLocaleString()} km</p></Card>
      <Card title="Battery Passport timeline"><Timeline entries={getEntries().reverse()} actions={false} publicToken={publicToken} /></Card>
      <Card title="Impact Ledger summary (all time)">
        <div className="grid gap-3 ">
          {types.map((t) => (
            <div key={t}><div className="mb-1"><DataTag t={t} /></div>
              <ul className="text-sm">{s.rows.filter((r) => r.t === t).map((r) => <li key={r.kind} className="flex justify-between"><span className="text-mute">{r.kind.replace(/_/g, " ")}</span><span>{r.v.toFixed(r.unit === "action" ? 0 : 1)} {r.unit}</span></li>)}</ul></div>
          ))}
        </div>
        <Disclaimer />
      </Card>
      <Card title="Assumptions">
        <ul className="list-disc space-y-1 pl-5 text-sm text-mute">
          <li>Electricity factor: {EMISSIONS.grid_electricity.value} kg CO2e/kWh, {EMISSIONS.grid_electricity.label}, data year {EMISSIONS.grid_electricity.data_year}. Source: {EMISSIONS.grid_electricity.source.name}. Not live.</li>
          <li>Comparison vehicle: {v.cmp_label}, {v.cmp_fuel}, {v.cmp_km_per_litre} km/L. Petrol {EMISSIONS.petrol.value} kg CO2/L (tailpipe only).</li>
          <li>Seeded history entries are demo data without evidence files.</li>
        </ul>
        <FactorNote />
      </Card>
    </div>
  );
}
