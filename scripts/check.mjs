// Checks every mod in mods/ against the game's live schema and this repo's
// house rules. Exits 1 on any problem, so CI fails the pull request.
//
//   npm run check
//   TESSERA4X_SITE=http://localhost:5173 npm run check   (against a local build)

import { existsSync } from 'node:fs';
import { changeCount, fetchSchema, LINK_MOST, listMods, playLinks, SECTIONS, SITE, VICTORIES } from './lib/mods.mjs';
import { validate } from './lib/schema.mjs';

const CONTROL = /[\u0000-\u001f\u007f]/;

/** A mod's name as two mods would clash on it. */
const nameKey = (json) => (typeof json?.name === 'string' ? json.name.trim().toLowerCase() : null);

/** Every piece of text in a mod, with where it sits. */
function* texts(value, path = '') {
  if (typeof value === 'string') yield [path, value];
  else if (Array.isArray(value)) for (const [i, item] of value.entries()) yield* texts(item, `${path}[${i}]`);
  else if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) yield* texts(item, path === '' ? key : `${path}.${key}`);
  }
}

/** What the house rules ask beyond the schema. */
function houseRules(mod, names) {
  const problems = [];
  const warnings = [];
  const { json } = mod;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(mod.slug)) problems.push(`folder "${mod.slug}": name it in lowercase words joined by hyphens, like "open-frontier"`);
  if (!existsSync(mod.readme)) problems.push('README.md is missing: copy the template in CONTRIBUTING.md');
  for (const [path, text] of texts(json)) {
    if (text !== text.trim()) problems.push(`${path}: has spaces at its start or end`);
    if (CONTROL.test(text)) problems.push(`${path}: must be one line of plain text`);
  }
  for (const section of SECTIONS) {
    for (const [id, fields] of Object.entries(json[section] ?? {})) {
      if (fields !== null && typeof fields === 'object' && Object.keys(fields).length === 0) problems.push(`${section}.${id}: changes nothing; leave it out`);
    }
  }
  for (const victory of VICTORIES) {
    if (json.victories?.[victory] === true) warnings.push(`victories.${victory}: true is the game's own rule already; list only the victories you switch off`);
  }
  if (changeCount(json) === 0) problems.push('changes nothing yet: add a section with something in it, a startEra, or a victory switched off');
  const others = (names.get(nameKey(json)) ?? []).filter((slug) => slug !== mod.slug);
  if (others.length > 0) problems.push(`name: "${json.name}" is also the name of ${others.map((s) => `mods/${s}`).join(', ')}`);
  if (playLinks(mod.slug, json) === null) warnings.push(`too long for a Play link (over ${LINK_MOST} characters encoded): players will load it from the file`);
  return { problems, warnings };
}

let schema;
try {
  schema = await fetchSchema();
} catch (error) {
  console.error(`✗ ${error.message}\n  The check needs the game's schema from ${SITE}/mods/schema.json.`);
  process.exit(2);
}

const mods = await listMods();
const names = new Map();
for (const mod of mods) {
  const key = nameKey(mod.json);
  if (key !== null) names.set(key, [...(names.get(key) ?? []), mod.slug]);
}
let failed = 0;
for (const mod of mods) {
  let problems = [];
  let warnings = [];
  if (mod.text === null) problems.push('mod.json is missing');
  else if (mod.parseError !== null) problems.push(`mod.json is not valid JSON: ${mod.parseError}`);
  else {
    problems = validate(mod.json, schema);
    const house = houseRules(mod, names);
    problems.push(...house.problems);
    warnings = house.warnings;
  }
  const label = mod.json?.name ? `${mod.slug} — ${mod.json.name}` : mod.slug;
  if (problems.length === 0) console.log(`✓ ${label} (${changeCount(mod.json)} changes)`);
  else {
    failed++;
    console.log(`✗ ${label}`);
    for (const p of problems) console.log(`    ${p}`);
  }
  for (const w of warnings) console.log(`    note: ${w}`);
}

console.log(`\n${mods.length - failed} of ${mods.length} mods pass against ${SITE}/mods/schema.json.`);
process.exit(failed === 0 ? 0 : 1);
