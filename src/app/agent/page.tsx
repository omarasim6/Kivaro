import { Card, PageTitle, Btn, Badge, Status, Empty } from "../ui";
import { db, getSetting } from "../../lib/db";
import { togglePause, setPerm, runNow, decideApproval } from "../actions";
import { ollamaHealth } from "../../lib/ai";
import { env } from "../../lib/config";

export const dynamic = "force-dynamic";

type Job = { id: number; type: string; status: string; attempts: number; report: string | null; error: string | null; created_at: string };
type Log = { id: number; ts: string; agent: string; action: string; inputs: string; outcome: string; job_id: number | null; model: string | null; edited_by_user: number | null };

export default async function Agent({ searchParams }: { searchParams: Promise<{ job?: string; agent?: string; filterJob?: string }> }) {
  const sp = await searchParams;
  const paused = getSetting("paused") === "1";
  const health = await ollamaHealth();
  const jobs = db().prepare("SELECT * FROM jobs ORDER BY id DESC LIMIT 10").all() as Job[];
  const approvals = db().prepare("SELECT * FROM approvals ORDER BY (status='pending') DESC, id DESC LIMIT 10").all() as { id: number; action: string; description: string; data_involved: string; status: string }[];
  const where: string[] = []; const args: (string | number)[] = [];
  if (sp.agent) { where.push("agent=?"); args.push(sp.agent); }
  if (sp.filterJob) { where.push("job_id=?"); args.push(Number(sp.filterJob)); }
  const logs = db().prepare(`SELECT * FROM activity_log ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC LIMIT 60`).all(...args) as Log[];
  const agents = (db().prepare("SELECT DISTINCT agent FROM activity_log").all() as { agent: string }[]).map((a) => a.agent);
  const highlight = sp.job ? jobs.find((j) => j.id === Number(sp.job)) : null;
  const perms: [string, string, string][] = [["perm_documents", "Uploaded documents", "Receipts and evidence files"], ["perm_charging", "Charging data", "Charging sessions and energy figures"], ["perm_location", "Location", "Reserved for future charger features"]];

  return (
    <>
      <PageTitle sub="Always-on, but never unlimited. The agent cannot send, pay, book or delete: it can only ask for your approval.">Agent controls</PageTitle>
      {highlight && (
        <Card title={`Coordinator report · job #${highlight.id}`} className="mb-4 border-brand/40" right={<Status s={highlight.status} />}>
          <p className="whitespace-pre-line text-sm">{highlight.report ?? "No report yet. Press Run agent now."}</p>
        </Card>
      )}
      <div className="grid gap-4 ">
        <Card title="Status">
          <div className="flex flex-wrap items-center gap-2"><Badge tone={paused ? "amber" : "green"}>{paused ? "paused" : "running"}</Badge><span className="text-xs text-mute">polls every {env.pollMs / 1000}s · max {env.maxRetries} retries · {env.maxJobsPerMin} jobs/min</span></div>
          <p className="mt-2 text-xs text-mute">AI (Ollama {health.model}): {health.reachable ? `reachable, model ${health.modelLoaded ? "loaded" : "not loaded"}` : "not reachable. Using cached sample / manual entry."}</p>
          <div className="mt-3 flex gap-2">
            <form action={runNow}><Btn>Run agent now</Btn></form>
            <form action={togglePause}><Btn kind="ghost">{paused ? "Resume" : "Pause"}</Btn></form>
          </div>
        </Card>
        <Card title="What the agent may access">
          <ul className="space-y-3">
            {perms.map(([k, l, d]) => (
              <li key={k} className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">{l}</p><p className="text-xs text-mute">{d}</p></div>
                <form action={setPerm}><input type="hidden" name="key" value={k} /><Btn kind={getSetting(k) === "1" ? "primary" : "ghost"}>{getSetting(k) === "1" ? "On" : "Off"}</Btn></form></li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Approval gate" className="mt-4"><div id="approvals" />
        {approvals.length === 0 ? <Empty>No approval requests. Sharing a report or deleting an entry will appear here.</Empty> : (
          <ul className="space-y-3">
            {approvals.map((a) => (
              <li key={a.id} className="rounded-2xl bg-card2 p-3 text-sm">
                <div className="flex items-center justify-between gap-2"><span className="font-medium">{a.description}</span><Status s={a.status} /></div>
                <p className="mt-1 text-xs text-mute">Data involved: {a.data_involved}</p>
                {a.status === "pending" && (
                  <div className="mt-2 flex gap-2">
                    {(["approve", "reject"] as const).map((d) => (
                      <form key={d} action={decideApproval}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="decision" value={d} /><Btn kind={d === "approve" ? "primary" : "danger"}>{d === "approve" ? "Approve" : "Reject"}</Btn></form>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Jobs" className="mt-4">
        {jobs.length === 0 ? <Empty>No jobs yet.</Empty> : (
          <ul className="space-y-2 text-sm">
            {jobs.map((j) => (
              <li key={j.id} className="rounded-2xl bg-card2 p-3">
                <div className="flex flex-wrap items-center gap-2"><span className="font-medium">#{j.id} {j.type.replace("_", " ")}</span><Status s={j.status} /><span className="text-xs text-mute">attempts {j.attempts}</span><a className="ml-auto text-xs text-brand2" href={`/agent?filterJob=${j.id}`}>log</a></div>
                {j.report && <p className="mt-1 whitespace-pre-line text-xs text-mute">{j.report}</p>}
                {j.error && <p className="mt-1 text-xs text-bad">{j.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Activity log (append-only)" className="mt-4" right={
        <form className="flex gap-2"><select name="agent" defaultValue={sp.agent ?? ""} className="!w-auto !py-1 text-xs"><option value="">All agents</option>{agents.map((a) => <option key={a}>{a}</option>)}</select><Btn kind="ghost" className="!min-h-8 !px-3 !py-1 !text-xs">Filter</Btn></form>}>
        {sp.filterJob && <p className="mb-2 text-xs text-mute">Showing job #{sp.filterJob}. <a className="text-brand2" href="/agent">Clear</a></p>}
        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-mute"><tr><th className="py-1 pr-2">Time</th><th className="pr-2">Agent</th><th className="pr-2">Action</th><th className="pr-2">Inputs</th><th className="pr-2">Outcome</th><th>Job</th><th className="pl-2">Model / edited</th></tr></thead>
          <tbody>{logs.map((l) => (
            <tr key={l.id} className="border-t border-line align-top"><td className="py-2 pr-2 whitespace-nowrap text-mute">{l.ts}</td><td className="pr-2">{l.agent}</td><td className="pr-2">{l.action}</td><td className="pr-2 text-mute">{l.inputs}</td><td className="pr-2">{l.outcome}</td><td>{l.job_id ?? ""}</td><td className="pl-2 text-mute">{l.model ? `${l.model}${l.edited_by_user ? ", edited" : l.edited_by_user === 0 ? ", unedited" : ""}` : ""}</td></tr>
          ))}</tbody></table></div>
      </Card>
    </>
  );
}
