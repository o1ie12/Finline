/**
 * What the class-mode browser tests create, and how it is taken away again.
 *
 * On the file store (the default) this only signs up throwaway accounts and
 * ages a room in .devstore.json. With E2E_REAL_DB=1 the local server is
 * pointed at a real database, so the rules are stricter:
 *
 *   - one test account, signed up once and reused (its code is kept in a
 *     file in OUT, never printed);
 *   - every room, participant and wrong-code row the run creates is tracked
 *     and deleted at the end, by exact id or key, never by a pattern;
 *   - a room is deleted only if the test account opened it during this run.
 *
 * E2E_SUPABASE_URL and E2E_SUPABASE_KEY come from the caller's environment.
 * Nothing here prints them.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const REAL = process.env.E2E_REAL_DB === "1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY_SHAPE = /^(dev:)?[0-9a-f]{64}$/;
const chunks = (xs, n) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

export function createTracker({ base, out }) {
  const startedAt = new Date(Date.now() - 60_000);
  const roomIds = new Set();
  const roomCodes = new Set();
  const ips = new Set();
  const devices = new Set();
  let account = null; // { code, id, name }
  let db = null;

  async function client() {
    if (!REAL) throw new Error("no database client on the file store");
    if (!db) {
      const { createClient } = await import("@supabase/supabase-js");
      db = createClient(process.env.E2E_SUPABASE_URL, process.env.E2E_SUPABASE_KEY, { auth: { persistSession: false } });
    }
    return db;
  }
  const signup = async (name) => {
    const res = await fetch(base + "/api/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, school: "自動測試", grade: "高二" }) });
    if (!res.ok) throw new Error(`signup ${res.status}`);
    return (await res.json()).access_code;
  };
  // The server salts with CLASS_RATE_SALT, else its database key (lib/classGuard.ts).
  const salt = process.env.E2E_RATE_SALT || process.env.E2E_SUPABASE_KEY || "";
  const salted = (what) => createHash("sha256").update(`${salt}:${what}`).digest("hex");

  return {
    real: REAL,
    /** An access code to sign in with. Real database: always the one test account. File store: a new account each time. */
    async account(name) {
      if (!REAL) return signup(name);
      if (account) return account.code;
      const file = path.join(out, ".e2e-account");
      const code = existsSync(file) ? readFileSync(file, "utf8").trim() : await signup("自動測試帳號");
      if (!existsSync(file)) writeFileSync(file, code, { mode: 0o600 });
      const { data, error } = await (await client()).from("students").select("id, name, created_at").eq("access_code", code).maybeSingle();
      if (error || !data) throw new Error("the test account is not in the database");
      account = { code, id: data.id, name: data.name, created_at: data.created_at };
      return code;
    },
    /** A second identity. Only on the file store: the real database gets one test account. */
    secondAccount: (name) => (REAL ? null : signup(name)),
    room(r) {
      if (r?.room_id && UUID.test(r.room_id)) roomIds.add(r.room_id);
      if (r?.code) roomCodes.add(r.code);
    },
    code: (c) => c && roomCodes.add(c),
    ip: (ip) => (ips.add(ip), ip),
    /** Remember the device cookie a wrong-code answer set, and return it as a Cookie header value (or ""). */
    device(res) {
      const set = res.headers.getSetCookie?.() ?? [];
      const hit = set.map((c) => c.match(/^fs_class_device=([0-9a-f-]{36})/i)?.[1]).find(Boolean);
      if (hit) devices.add(hit);
      return hit ? `fs_class_device=${hit}` : "";
    },
    /** Make a room look unused for a little over 12 hours. */
    async ageRoom(roomId) {
      const at = new Date(Date.now() - 12.1 * 3600 * 1000).toISOString();
      if (!REAL) {
        const file = path.join(process.cwd(), ".devstore.json");
        const store = JSON.parse(readFileSync(file, "utf8"));
        const row = store.class_rooms.find((r) => r.id === roomId);
        row.last_active_at = at;
        row.created_at = at;
        writeFileSync(file, JSON.stringify(store));
        return;
      }
      if (!UUID.test(roomId) || !roomIds.has(roomId)) throw new Error("refusing to age a room this run did not create");
      const { error } = await (await client()).from("class_rooms").update({ last_active_at: at }).eq("id", roomId).eq("host_student_id", account.id);
      if (error) throw new Error(`ageRoom: ${error.message}`);
    },
    /** Delete what this run created (real database only) and say exactly what went and what stays. */
    async cleanup() {
      if (!REAL) return null;
      const c = await client();
      const report = { account: account ? { id: account.id, name: account.name, created_at: account.created_at } : null, deleted: { rooms: [], participants: [], attempts: 0 }, refused: [], left: { lifeSaves: [], attemptsSinceStart: 0, roomsOfAccount: 0 } };
      if (!account) return report;

      // Rooms: the tracked ids and codes, plus any other room the test account opened during the run.
      const found = new Map();
      const take = (rows) => (rows ?? []).forEach((r) => found.set(r.id, r));
      const cols = "id, code, kind, status, host_student_id, created_at";
      for (const ids of chunks([...roomIds], 20)) take((await c.from("class_rooms").select(cols).in("id", ids)).data);
      for (const codes of chunks([...roomCodes], 20)) take((await c.from("class_rooms").select(cols).in("code", codes)).data);
      take((await c.from("class_rooms").select(cols).eq("host_student_id", account.id).gte("created_at", startedAt.toISOString())).data);
      const mine = [...found.values()].filter((r) => r.host_student_id === account.id && new Date(r.created_at) >= startedAt && UUID.test(r.id));
      report.refused = [...found.values()].filter((r) => !mine.includes(r)).map((r) => ({ id: r.id, code: r.code, why: "not opened by the test account during this run" }));
      const ids = mine.map((r) => r.id);

      if (ids.length) {
        for (const part of chunks(ids, 20)) {
          const { data: people } = await c.from("class_participants").select("id, display_name, room_id").in("room_id", part);
          const saves = await c.from("life_game_saves").select("id, class_team_id").or(part.map((id) => `class_team_id.like.${id}:*`).join(","));
          report.left.lifeSaves.push(...(saves.data ?? []));
          if (people?.length) {
            const { error } = await c.from("class_participants").delete().in("id", people.map((p) => p.id));
            if (error) throw new Error(`delete participants: ${error.message}`);
            report.deleted.participants.push(...people);
          }
          const { error } = await c.from("class_rooms").delete().in("id", part);
          if (error) throw new Error(`delete rooms: ${error.message}`);
        }
        report.deleted.rooms = mine.map((r) => ({ id: r.id, code: r.code, kind: r.kind ?? "quiz", status: r.status }));
      }

      // Wrong-code rows: only the keys of the addresses and device cookies this run used.
      const keys = [...[...ips].map(salted), ...[...devices].map((d) => `dev:${salted(d)}`)].filter((k) => KEY_SHAPE.test(k));
      for (const part of chunks(keys, 25)) {
        const { data, error } = await c.from("class_join_attempts").delete().in("ip_hash", part).select("id");
        if (error) throw new Error(`delete attempts: ${error.message}`);
        report.deleted.attempts += data?.length ?? 0;
      }
      report.left.attemptsSinceStart = (await c.from("class_join_attempts").select("id", { count: "exact", head: true }).gte("attempted_at", startedAt.toISOString())).count ?? 0;
      report.left.roomsOfAccount = (await c.from("class_rooms").select("id", { count: "exact", head: true }).eq("host_student_id", account.id)).count ?? 0;
      writeFileSync(path.join(out, `cleanup-${Date.now()}.json`), JSON.stringify(report, null, 2));
      return report;
    },
  };
}
