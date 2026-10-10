import { Card, PageTitle, Btn, Field, Notice } from "../ui";
import { getVehicle } from "../../lib/queries";
import { saveVehicle } from "../actions";
import { EMISSIONS, env } from "../../lib/config";

export const dynamic = "force-dynamic";

export default async function Settings({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const v = getVehicle();
  return (
    <>
      <PageTitle sub="Vehicle and comparison vehicle used for emission estimates.">Settings</PageTitle>
      <Notice ok={saved ? "Vehicle saved." : undefined} />
      <div className="grid gap-4 ">
        <Card title="Vehicle">
          <form action={saveVehicle} className="grid grid-cols-2 gap-3">
            <Field label="Make"><input name="make" defaultValue={v.make} required /></Field>
            <Field label="Model"><input name="model" defaultValue={v.model} required /></Field>
            <Field label="Year"><input type="number" name="year" defaultValue={v.year} /></Field>
            <Field label="Plate"><input name="plate" defaultValue={v.plate} /></Field>
            <Field label="Battery (kWh)"><input type="number" step="0.01" name="battery_kwh" defaultValue={v.battery_kwh} /></Field>
            <Field label="Current odometer (km)"><input type="number" name="odometer_km" defaultValue={v.odometer_km} /></Field>
            <div className="col-span-2"><Field label="Comparison vehicle label"><input name="cmp_label" defaultValue={v.cmp_label} /></Field></div>
            <Field label="Fuel type"><input name="cmp_fuel" defaultValue={v.cmp_fuel} /></Field>
            <Field label="Assumed km per litre"><input type="number" step="0.1" name="cmp_km_per_litre" defaultValue={v.cmp_km_per_litre} /></Field>
            <div className="col-span-2"><Btn>Save vehicle</Btn></div>
          </form>
        </Card>
        <Card title="Configuration (read-only)">
          <ul className="space-y-1 text-sm text-mute">
            <li>Ollama URL: {env.ollamaUrl}</li><li>Ollama model: {env.ollamaModel}</li><li>Cached extraction: {String(env.useCached)}</li>
            <li>Emission factor: {EMISSIONS.grid_electricity.value} kg CO2e/kWh ({EMISSIONS.grid_electricity.data_year})</li>
          </ul>
          <p className="mt-3 text-xs text-mute">Change these in .env and config/emission-factors.json.</p>
        </Card>
      </div>
    </>
  );
}
