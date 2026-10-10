import { Card, PageTitle, Btn, Field, Notice } from "../ui";
import { uploadReceipt } from "../actions";
import { db } from "../../lib/db";
import Link from "next/link";
import { Status } from "../ui";

export const dynamic = "force-dynamic";

export default async function Upload({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const recent = db().prepare("SELECT id, original_name, status, is_duplicate_file, created_at FROM receipts ORDER BY id DESC LIMIT 8").all() as { id: number; original_name: string; status: string; is_duplicate_file: number }[];
  return (
    <>
      <PageTitle sub="Upload a service receipt. The agent extracts the fields; you review and confirm before anything is saved.">Upload receipt</PageTitle>
      <Notice error={error} />
      <div className="grid gap-4 ">
        <Card title="New receipt">
          <form action={uploadReceipt} className="space-y-3">
            <Field label="Receipt (JPG, PNG or PDF)"><input type="file" name="file" accept="image/png,image/jpeg,.pdf" required /></Field>
            <Btn>Upload and run agent</Btn>
          </form>
          <p className="mt-3 text-xs text-mute">The same file uploaded twice is detected by its SHA-256 hash and earns zero points.</p>
        </Card>
        <Card title="Recent uploads">
          {recent.length === 0 ? <p className="text-sm text-mute">Nothing uploaded yet.</p> : (
            <ul className="space-y-2 text-sm">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2">
                  <Link href={`/upload/${r.id}`} className="truncate text-brand2 underline">{r.original_name}</Link>
                  <span className="flex gap-1">{r.is_duplicate_file ? <span className="text-xs text-bad">duplicate</span> : null}<Status s={r.status} /></span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
