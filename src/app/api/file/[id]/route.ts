import fs from "node:fs";
import { db } from "../../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = db().prepare("SELECT stored_path, mime, original_name FROM receipts WHERE id=?").get(Number(id)) as { stored_path: string; mime: string; original_name: string } | undefined;
  if (!r || !fs.existsSync(r.stored_path)) return new Response("Not found", { status: 404 });
  const buf = fs.readFileSync(r.stored_path);
  const type = r.mime || (r.original_name.endsWith(".pdf") ? "application/pdf" : r.original_name.match(/jpe?g$/i) ? "image/jpeg" : "image/png");
  return new Response(buf, { headers: { "Content-Type": type, "Content-Disposition": `inline; filename="${r.original_name}"` } });
}
