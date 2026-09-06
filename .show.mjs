import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; }),
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const st = process.argv[2];
const { data: rules } = await db.from("state_cottage_food_rules").select("*").eq("state_code", st);
const { data: progs } = await db.from("state_food_programs").select("*").eq("state_code", st).order("ordinal");
console.log("=== state_cottage_food_rules ==="); console.log(JSON.stringify(rules, null, 1));
console.log("=== state_food_programs ===");
for (const p of progs ?? []) {
  console.log(JSON.stringify(p, null, 1));
  const { data: lr } = await db.from("state_label_rules").select("*").eq("program_id", p.id);
  console.log("--- label rule ---"); console.log(JSON.stringify(lr, null, 1));
}
