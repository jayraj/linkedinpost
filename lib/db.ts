import { neon, QueryResult } from '@neondatabase/serverless';

export interface Topic { title: string; why: string; source: string; sourceUrl: string; }
export interface Draft {
  id: string; week_of: string; topics: Topic[]; chosen_topic: string;
  content: string; status: 'pending'|'approved'|'posted'|'expired'|'failed';
  image_data: string | null; image_mime: string | null; image_status: string;
  token_expires: string; created_at: string; updated_at: string;
}

let _sql: ReturnType<typeof neon> | undefined;
export function db() { if (!process.env.DATABASE_URL) throw new Error('Missing DATABASE_URL'); return (_sql ??= neon(process.env.DATABASE_URL)); }

function parseTopics(v: unknown): Topic[] { if (typeof v==='string') return JSON.parse(v) as Topic[]; return (v??[]) as Topic[]; }
function rows<T extends Record<string,unknown>>(r: any): T[] { if (!r) return []; if (Array.isArray(r)) return r as T[]; return (r.rows ?? (r as any) ?? []) as T[]; }

export function rowToDraft(r: Record<string,unknown>): Draft {
  return { id: String(r.id), week_of: String(r.week_of), topics: parseTopics(r.topics), chosen_topic: String(r.chosen_topic), content: String(r.content), status: r.status as any, image_data: r.image_data == null ? null : String(r.image_data), image_mime: r.image_mime == null ? null : String(r.image_mime), image_status: r.image_status == null ? 'none' : String(r.image_status), token_expires: String(r.token_expires), created_at: String(r.created_at), updated_at: String(r.updated_at) };
}

export async function getDraft(id: string): Promise<Draft|null> {
  const res = await db()`SELECT * FROM drafts WHERE id=${id}`;
  const r = rows<Record<string,unknown>>(res); return r.length ? rowToDraft(r[0]) : null;
}
export async function getDraftForWeek(weekOf: string): Promise<Draft|null> {
  const res = await db()`SELECT * FROM drafts WHERE week_of=${weekOf} ORDER BY created_at DESC`;
  const r = rows<Record<string,unknown>>(res); return r.length ? rowToDraft(r[0]) : null;
}
export async function createDraft(d: {weekOf: string; topics: Topic[]; chosenTopic: string; content: string; tokenExpires: Date; imageData?: string|null; imageMime?: string|null; imageStatus?: string}): Promise<Draft> {
  const res = await db()`INSERT INTO drafts (week_of,topics,chosen_topic,content,token_expires,image_data,image_mime,image_status) VALUES (${d.weekOf},${JSON.stringify(d.topics)},${d.chosenTopic},${d.content},${d.tokenExpires.toISOString()},${d.imageData??null},${d.imageMime??null},${d.imageStatus??'none'}) RETURNING *`;
  const r = rows<Record<string,unknown>>(res); return rowToDraft(r[0]);
}
export async function updateDraft(id: string, patch: {content?:string; chosenTopic?:string; status?:Draft['status']; image?: {data:string|null; mime:string|null; status:string}}): Promise<void> {
  if (patch.image) {
    await db()`UPDATE drafts SET content=COALESCE(${patch.content??null},content), chosen_topic=COALESCE(${patch.chosenTopic??null},chosen_topic), status=COALESCE(${patch.status??null},status), image_data=${patch.image.data}, image_mime=${patch.image.mime}, image_status=${patch.image.status}, updated_at=now() WHERE id=${id}`;
    return;
  }
  await db()`UPDATE drafts SET content=COALESCE(${patch.content??null},content), chosen_topic=COALESCE(${patch.chosenTopic??null},chosen_topic), status=COALESCE(${patch.status??null},status), updated_at=now() WHERE id=${id}`;
}
export async function logAction(draftId: string|null, action: string, detail: Record<string,unknown>={}) {
  await db()`INSERT INTO post_log (draft_id,action,detail) VALUES (${draftId},${action},${JSON.stringify(detail)})`;
}
export async function hasRecentLog(action: string, withinHours: number): Promise<boolean> {
  const res = await db()`SELECT 1 FROM post_log WHERE action=${action} AND created_at>now()-make_interval(hours=>${withinHours}) LIMIT 1`;
  const r = rows<any>(res); return r.length>0;
}
export function currentMonday(): string {
  const now = new Date(); const day = now.getUTCDay(); const diff=(day+6)%7;
  const mon = new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-diff));
  return mon.toISOString().slice(0,10);
}
