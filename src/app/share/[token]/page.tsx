import { db } from "../../../lib/db";
import { ReportBody } from "../../report-body";
import { PageTitle } from "../../ui";

export const dynamic = "force-dynamic";

export default async function Shared({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const s = db().prepare("SELECT revoked FROM shares WHERE token=?").get(token) as { revoked: number } | undefined;
  if (!s || s.revoked) return <PageTitle sub="This share link does not exist or was revoked by the owner.">Link unavailable</PageTitle>;
  return (<><PageTitle sub="Read-only Battery Passport report shared by the vehicle owner.">Battery Passport report</PageTitle><ReportBody publicToken={token} /></>);
}
