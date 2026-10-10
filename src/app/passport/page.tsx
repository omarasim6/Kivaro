import { Card, PageTitle, Btn, Field, Notice } from "../ui";
import { Timeline } from "../parts";
import { getEntries, getVehicle } from "../../lib/queries";
import { addManualEntry } from "../actions";
import { ENTRY_TYPES } from "../../lib/config";

export const dynamic = "force-dynamic";

export default async function Passport({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const v = getVehicle();
  return (
    <>
      <PageTitle sub={`${v.make} ${v.model} · ${v.plate}`}>Battery Passport</PageTitle>
      <Notice error={error} />
      <div className="grid gap-4 ">
        <div className=""><Card title="Timeline (newest first)"><Timeline entries={getEntries()} /></Card></div>
        <div className="">
          <Card title="Add entry manually">
            <form action={addManualEntry} className="space-y-3">
              <Field label="Type"><select name="type">{ENTRY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></Field>
              <Field label="Date"><input type="date" name="date" required /></Field>
              <Field label="Odometer (km)"><input type="number" name="odometer" min="0" inputMode="numeric" /></Field>
              <Field label="Workshop (optional)"><input name="workshop" /></Field>
              <Field label="Notes"><textarea name="notes" rows={2} /></Field>
              <Field label="Evidence file (optional, JPG/PNG/PDF)"><input type="file" name="file" accept="image/*,.pdf" /></Field>
              <p className="text-xs text-mute">Entries without evidence stay “needs review” and earn no points.</p>
              <Btn>Save entry</Btn>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
