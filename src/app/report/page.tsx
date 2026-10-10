import { Card, PageTitle, Btn, Empty, Badge } from "../ui";
import { ReportBody } from "../report-body";
import { db } from "../../lib/db";
import { requestShare, revokeShare } from "../actions";

export const dynamic = "force-dynamic";

export default async function Report() {
  const shares = db().prepare("SELECT * FROM shares ORDER BY id DESC").all() as { id: number; token: string; revoked: number; created_at: string }[];
  const pending = db().prepare("SELECT COUNT(*) c FROM approvals WHERE action='share_report' AND status='pending'").get() as { c: number };
  return (
    <>
      <PageTitle sub="Show your battery history to a buyer or workshop.">Report</PageTitle>
      <Card title="Share" className="mb-4">
        <form action={requestShare}><Btn disabled={pending.c > 0}>{pending.c ? "Waiting for your approval (Agent page)" : "Request share link"}</Btn></form>
        <p className="mt-2 text-xs text-mute">A link is created only after you approve it at the Approval Gate. You can revoke it any time.</p>
        {shares.length > 0 && (
          <ul className="mt-3 space-y-2 text-sm">
            {shares.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2">
                {s.revoked ? <Badge tone="red">revoked</Badge> : <Badge tone="green">active</Badge>}
                <a className="break-all text-brand2 underline" href={`/share/${s.token}`}>/share/{s.token}</a>
                {!s.revoked && <form action={revokeShare}><input type="hidden" name="id" value={s.id} /><Btn kind="danger" className="!min-h-8 !px-3 !py-1 !text-xs">Revoke</Btn></form>}
              </li>
            ))}
          </ul>
        )}
        {shares.length === 0 && <div className="mt-3"><Empty>No share links yet.</Empty></div>}
      </Card>
      <ReportBody />
    </>
  );
}
