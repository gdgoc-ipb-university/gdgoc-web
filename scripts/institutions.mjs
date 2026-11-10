#!/usr/bin/env node
// Rebuilds the onboarding suggestion lists in src/lib/institutions from the ministry's public reference pages
// (referensi.data.kemendikdasmen.go.id): every SMA, MA, SMK and MAK in West Java, Jakarta and Banten, and every higher-education
// institution in Indonesia. See docs/ONBOARDING.md, "Suggestion sources".
//
//   node scripts/institutions.mjs [--cache <dir>] [--only schools|campuses]
//
// Pages are cached by path (md5 of the path, as .html) so a rerun does not ask the site again. Requests run four at a
// time with a short pause; a full crawl is about 2,600 pages. Districts whose counts show no school are not fetched.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = "https://referensi.data.kemendikdasmen.go.id";
const cacheFlag = process.argv.indexOf("--cache");
const cache = cacheFlag > 0 ? process.argv[cacheFlag + 1] : join(tmpdir(), "gdgoc-institutions-cache");
const onlyFlag = process.argv.indexOf("--only");
const only = onlyFlag > 0 ? process.argv[onlyFlag + 1] : null;
const out = new URL("../src/lib/institutions/", import.meta.url);
mkdirSync(cache, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function get(path) {
  const file = join(cache, `${createHash("md5").update(path).digest("hex")}.html`);
  if (existsSync(file)) return readFileSync(file, "utf8");
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(base + path, { headers: { "user-agent": "gdgoc-web onboarding suggestions (low rate)" } });
      if (!response.ok) throw new Error(String(response.status));
      const text = await response.text();
      writeFileSync(file, text); await sleep(250);
      return text;
    } catch { await sleep(2000 + 3000 * attempt); }
  }
  console.error("failed", path);
  return "";
}

const entities = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };
const decode = (text) => text.replace(/&(#?\w+);/g, (all, name) => entities[name] ?? (name.startsWith("#") ? String.fromCharCode(Number(name.slice(1))) : all));
const cell = (html) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const rows = (html) => [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(([, row]) => [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(([, value]) => cell(value)));
const number = (value) => Number(String(value ?? "").replace(/[.,]/g, "")) || 0;

/** The sub-regions linked from a page, with the count columns of their table row. */
function children(html, kind, level) {
  const table = rows(html), head = table[0] ?? [];
  const byName = new Map(table.slice(1).filter((row) => row.length > 2).map((row) => [row[1], row]));
  return [...html.matchAll(new RegExp(`href="/satpen/${kind}/(\\d{6})/${level}[^"]*"[^>]*>\\s*([^<]+?)\\s*<`, "g"))].map(([, code, name]) => {
    const row = byName.get(decode(name).trim());
    return { code, name: decode(name).trim(), counts: row ? Object.fromEntries(head.map((key, index) => [key, row[index]])) : null };
  });
}

/** Every school row in the given provinces, from district pages that list at least one of the wanted kind. */
async function crawl(kind, provinces, wanted) {
  const jobs = [];
  for (const province of provinces) {
    const page = await get(`/satpen/${kind}/${province}/1?jalur=jf&status=all`);
    const provinceName = cell(page).match(/per Prov\. ([^▱]+?) Rekap/)?.[1]?.trim() ?? province;
    for (const regency of children(page, kind, 2)) {
      const regencyPage = await get(`/satpen/${kind}/${regency.code}/2?jalur=jf&status=all`);
      for (const district of children(regencyPage, kind, 3)) {
        const total = district.counts ? Object.entries(district.counts).filter(([key]) => wanted(key)).reduce((sum, [, value]) => sum + number(value), 0) : 1;
        if (total > 0) jobs.push({ province: provinceName, regency: regency.name, district: district.name, code: district.code });
      }
    }
    console.error(kind, provinceName, jobs.length, "districts so far");
  }
  const found = [];
  for (let index = 0; index < jobs.length; index += 4) {
    const batch = await Promise.all(jobs.slice(index, index + 4).map(async (job) => {
      const table = rows(await get(`/satpen/${kind}/${job.code}/3?jalur=jf&status=all`)), head = table[0] ?? [];
      return table.slice(1).map((row) => ({ ...Object.fromEntries(head.map((key, at) => [key, row[at]])), ...job }));
    }));
    found.push(...batch.flat());
  }
  return found;
}

/** "Kota Adm. Jakarta Timur" reads as "Jakarta Timur"; "Kab. Adm. Kep. Seribu" as "Kep. Seribu". */
const place = (regency) => regency.replace(/^Kota Adm\. /, "").replace(/^Kab\. Adm\. /, "");
const district = (name) => name.replace(/^Kec\. /, "");
/** Same-named schools in different places get their place in the name, so each suggestion saves a distinct value. */
function distinct(list, label) {
  const count = new Map();
  for (const item of list) count.set(item.name, (count.get(item.name) ?? 0) + 1);
  const used = new Set();
  return list.map((item) => {
    let name = count.get(item.name) > 1 ? `${item.name} (${label(item)})` : item.name;
    for (let n = 2; used.has(name); n++) name = `${item.name} (${label(item)} ${n})`;
    used.add(name);
    return [name, item.detail];
  });
}

// SMA, MA, SMK and MAK, Bogor and its neighbours first, then the rest of the three provinces; state schools before private.
const near = ["Kota Bogor", "Kab. Bogor", "Kota Depok", "Kota Bekasi", "Kab. Bekasi", "Kota Tangerang Selatan", "Kota Tangerang", "Kab. Tangerang"];
const rank = (regency) => near.includes(regency) ? near.indexOf(regency) : regency.startsWith("Kota Adm. Jakarta") ? near.length : near.length + 1;
if (only !== "campuses") {
const schools = new Map();
for (const row of await crawl("dikmen", ["020000", "010000", "280000"], (key) => key.startsWith("SMA") || key.startsWith("SMK"))) {
  if (!["SMA", "MA", "SMK", "MAK"].includes(row.Bentuk) || !row.NPSN || schools.has(row.NPSN)) continue;
  schools.set(row.NPSN, { name: row["Nama sekolah"], detail: `${place(row.regency)} · ${district(row.district)}`, regency: row.regency, state: row.Status === "NEGERI", district: row.district });
}
const schoolList = [...schools.values()].sort((a, b) => rank(a.regency) - rank(b.regency) || a.regency.localeCompare(b.regency, "id") || Number(b.state) - Number(a.state) || a.name.localeCompare(b.name, "id"));
writeFileSync(new URL("schools.json", out), `${JSON.stringify(distinct(schoolList, (item) => place(item.regency)))}\n`);
console.error("schools", schoolList.length);
}

// Higher education: universities, institutes, polytechnics, colleges, academies. Bogor first, then by form and name.
if (only !== "schools") {
const forms = ["Universitas", "Institut", "Politeknik", "Sekolah Tinggi", "Akademik"];
const campuses = new Map();
for (const row of await crawl("dikti", [...(await get("/satpen/dikti")).matchAll(/\/satpen\/dikti\/(\d{6})\/1/g)].map(([, code]) => code).filter((code, index, all) => all.indexOf(code) === index), (key) => forms.some((form) => key.startsWith(form.split(" ")[0])))) {
  const name = row["Nama satuan pendidikan"] ?? row["Nama sekolah"] ?? row["Nama"] ?? "";
  const id = row.NPSN || row["Kode PT"] || `${name}|${row.regency}`;
  if (!name || campuses.has(id)) continue;
  campuses.set(id, { name, detail: place(row.regency), regency: row.regency, form: forms.indexOf(row.Bentuk) });
}
// Unknown forms sort last; within Bogor and the rest, universities come before institutes, polytechnics, colleges and academies.
const formRank = (form) => form < 0 ? forms.length : form;
const campusList = [...campuses.values()].sort((a, b) => Number(!a.regency.endsWith("Bogor")) - Number(!b.regency.endsWith("Bogor")) || formRank(a.form) - formRank(b.form) || a.name.localeCompare(b.name, "id"));
writeFileSync(new URL("campuses.json", out), `${JSON.stringify(distinct(campusList, (item) => place(item.regency)))}\n`);
console.error("campuses", campusList.length);
}
