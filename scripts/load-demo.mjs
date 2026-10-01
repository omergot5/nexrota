// Concurrency check for the guest demo: node scripts/load-demo.mjs 5 10 15 20
// Hits the REAL Supabase project and leaves N orphan demo teams per wave
// (same as N real visitors) — not part of `npm test`.
import { spawn } from "node:child_process";
const waves = process.argv.slice(2).map(Number).filter(Boolean);
const one = () => new Promise((res) => {
  let buf = "";
  const p = spawn(process.execPath, ["scripts/load-demo-user.mjs"], { stdio: ["ignore", "pipe", "pipe"] });
  p.stdout.on("data", (d) => (buf += d));
  p.stderr.on("data", (d) => (buf += d));
  p.on("close", () => { try { res(JSON.parse(buf.trim().split("\n").pop())); } catch { res({ ok: false, error: buf.slice(-200) }); } });
});
let bad = 0;
for (const n of waves) {
  const t0 = Date.now();
  const r = await Promise.all(Array.from({ length: n }, one));
  const ok = r.filter((x) => x.ok && x.mode === "army" && x.guards === 15 && x.items > 0);
  const ms = r.map((x) => x.ms).sort((a, b) => a - b);
  console.log(`${n} users: ${ok.length}/${n} fully OK · wall ${((Date.now() - t0) / 1000).toFixed(1)}s · median ${ms[ms.length >> 1]}ms · max ${ms.at(-1)}ms`);
  r.filter((x) => !ok.includes(x)).slice(0, 3).forEach((x) => console.log("   fail:", JSON.stringify(x).slice(0, 250)));
  bad += n - ok.length;
}
process.exit(bad ? 1 : 0);
