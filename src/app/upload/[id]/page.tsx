import { notFound } from "next/navigation";
import { Card, PageTitle, Btn, Field, Notice, Badge } from "../../ui";
import { BackLink } from "../../parts";
import { db } from "../../../lib/db";
import { confirmReceipt } from "../../actions";
import { ENTRY_TYPES } from "../../../lib/config";
import type { Extracted } from "../../../lib/ai";

export const dynamic = "force-dynamic";

export default async function Review({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params; const { error } = await searchParams;
  const r = db().prepare("SELECT * FROM receipts WHERE id=?").get(Number(id)) as { id: number; original_name: string; mime: string; status: string; is_duplicate_file: number; extracted_json: string | null; extraction_source: string | null; entry_id: number | null } | undefined;
  if (!r) notFound();
  const x = r.extracted_json ? (JSON.parse(r.extracted_json) as Extracted) : null;
  const conf = (k: string) => (x?.confidence?.[k] != null ? `${Math.round(x.confidence[k] * 100)}% confident` : "");
  const waiting = r.status === "uploaded";
  const confirmed = r.status === "confirmed";
  return (
    <>
      <BackLink href="/upload">Upload</BackLink>
      <PageTitle sub={r.original_name}>Review extracted fields</PageTitle>
      <Notice error={error} />
      {r.is_duplicate_file ? <p className="mb-4 rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm text-bad">Duplicate evidence: this exact file was uploaded before. If you confirm, the entry is recorded as a duplicate and earns zero points.</p> : null}
      <div className="grid gap-4 ">
        <Card title="Evidence">
          {r.mime?.startsWith("image") || /\.(png|jpe?g)$/i.test(r.original_name)
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={`/api/file/${r.id}`} alt="Receipt" className="max-h-[560px] w-full rounded-xl border border-line object-contain bg-white" />
            : <a className="text-brand2 underline" href={`/api/file/${r.id}`} target="_blank">Open file</a>}
        </Card>
        <Card title="Fields (editable)" right={x ? <Badge tone="blue">{r.extraction_source === "cached_sample" ? "cached sample" : "extracted"}</Badge> : <Badge tone="amber">manual</Badge>}>
          {waiting && <p className="mb-3 rounded-xl border border-brand2/30 bg-brand2/10 p-3 text-sm">Waiting for the agent. Press “Run agent now” on the Dashboard or Agent page (or start the worker).</p>}
          {!waiting && !x && <p className="mb-3 rounded-xl border border-warn/30 bg-warn/10 p-3 text-sm text-warn">AI extraction is not connected yet. Please fill in the fields manually.</p>}
          {confirmed ? <p className="text-sm text-brand">Already confirmed and saved to the timeline.</p> : (
            <form action={confirmReceipt} className="space-y-3">
              <input type="hidden" name="receiptId" value={r.id} />
              <Field label={`Service date ${conf("service_date")}`}><input type="date" name="date" defaultValue={x?.service_date ?? ""} required /></Field>
              <Field label={`Odometer (km) ${conf("odometer_km")}`}><input type="number" name="odometer" defaultValue={x?.odometer_km ?? ""} required /></Field>
              <Field label={`Workshop ${conf("workshop_name")}`}><input name="workshop" defaultValue={x?.workshop_name ?? ""} /></Field>
              <Field label={`Service type ${conf("service_type")}`}><select name="type" defaultValue={x?.service_type ?? "service"}>{ENTRY_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
              <Field label={`Battery notes ${conf("battery_notes")}`}><textarea name="notes" rows={2} defaultValue={x?.battery_notes ?? ""} /></Field>
              {x?.total_amount != null && <p className="text-xs text-mute">Total on receipt: PKR {x.total_amount.toLocaleString()} (not stored)</p>}
              <Btn>Confirm and save to timeline</Btn>
              <p className="text-xs text-mute">Nothing is added to your Battery Passport until you confirm.</p>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
