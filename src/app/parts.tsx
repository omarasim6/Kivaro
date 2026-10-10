import Link from "next/link";
import { Status, Badge, DataTag, Empty, Btn } from "./ui";
import { requestDelete } from "./actions";
import type { EntryRow } from "../lib/queries";

export function Timeline({ entries, actions = true, publicToken }: { entries: EntryRow[]; actions?: boolean; publicToken?: string }) {
  if (!entries.length) return <Empty>No timeline entries yet. Upload a receipt or add one manually.</Empty>;
  return (
    <ol className="space-y-3">
      {entries.map((e) => (
        <li key={e.id} className="rounded-2xl bg-card2 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold capitalize">{e.type}</span>
            <Status s={e.status} />
            {e.is_duplicate ? <Badge tone="red">duplicate</Badge> : null}
            <DataTag t={e.data_source_type} />
            <span className="ml-auto text-sm text-mute">{e.date}</span>
          </div>
          <div className="mt-1 text-sm text-mute">
            {e.odometer != null ? `${e.odometer.toLocaleString()} km` : "odometer missing"} · {e.workshop ?? "workshop not given"} · source: {e.source}
          </div>
          {e.notes && <p className="mt-1 text-sm">{e.notes}</p>}
          <p className="mt-1 text-xs text-mute">Validation: {e.status_reason}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            {e.evidence_receipt_id && (
              <a className="text-brand2 underline" href={publicToken ? `/api/file/${e.evidence_receipt_id}?share=${publicToken}` : `/api/file/${e.evidence_receipt_id}`} target="_blank">View evidence file</a>
            )}
            {actions && (
              <form action={requestDelete}><input type="hidden" name="id" value={e.id} /><Btn kind="danger" className="!min-h-8 !px-3 !py-1 !text-xs">Request delete</Btn></form>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

export const BackLink = ({ href, children }: { href: string; children: React.ReactNode }) => <Link href={href} className="mb-3 inline-block text-sm text-brand2">← {children}</Link>;
