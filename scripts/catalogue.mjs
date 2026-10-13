// Writes the generated parts of the READMEs: the catalogue in the main
// README, and in each mod's README its heading block (description, Play
// links) and its table of changes, each between its markers. Everything is
// read from the mods themselves and the game's own values in its published
// brief, so a README can't disagree with its mod.
//
//   npm run catalogue            rewrite the generated parts
//   npm run catalogue -- --check fail if any are out of date (CI runs this)

import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import {
  changeCount,
  ERA_NAMES,
  fetchStock,
  listed,
  listMods,
  playLinks,
  ROOT,
  SECTIONS,
  VICTORIES,
  VICTORY_NAMES,
} from './lib/mods.mjs';

const CHECK = process.argv.includes('--check');
const KIND = { units: 'Unit', buildings: 'Building', wonders: 'Wonder', techs: 'Tech', civs: 'Civilization', terrain: 'Terrain', features: 'Feature' };

const cell = (text) => String(text).replace(/\|/g, '\\|');

/** How a game under the mod begins and ends, in words; empty when it keeps the game's own. */
function settings(mod) {
  const lines = [];
  if (mod.startEra !== undefined) lines.push(['Start', `Begins in the ${ERA_NAMES[mod.startEra]} era`]);
  const off = VICTORIES.filter((v) => mod.victories?.[v] === false);
  if (off.length > 0) lines.push(['Victories', `No victory by ${listed(off.map((v) => VICTORY_NAMES[v]))}`]);
  return lines;
}

/** The badges after a mod's description in the catalogue. */
function badges(mod) {
  const out = [];
  if (mod.startEra !== undefined) out.push(`${ERA_NAMES[mod.startEra]} start`);
  const off = VICTORIES.filter((v) => mod.victories?.[v] === false);
  if (off.length === VICTORIES.length) out.push('conquest or score only');
  else if (off.length > 0) out.push(`no ${listed(off.map((v) => VICTORY_NAMES[v].replace(/^the /, '')))} victory`);
  return out.length === 0 ? '' : ` *${out.join(' · ')}*`;
}

/** One field's change as a table cell: the game's value, then the mod's. */
function change(field, value, was) {
  const old = was?.values?.[field];
  if (field === 'name') return `name: ${was?.name ?? '…'} → **${value}**`;
  if (field === 'blurb') return `new wording: “${value}”`;
  if (field === 'cityNames') return `cityNames: ${old ?? '…'} → **${value.join(', ')}**`;
  if (field === 'yields') {
    return `yields: ${Object.entries(value)
      .map(([k, v]) => `${k} ${old?.[k] ?? '…'} → **${v}**`)
      .join(', ')}`;
  }
  return `${field}: ${old ?? '…'} → **${value}**`;
}

function changesTable(mod, stock) {
  const rows = ['| Kind | Entry | Change |', '|------|-------|--------|'];
  for (const [entry, text] of settings(mod)) rows.push(`| Game | ${entry} | ${cell(text)} |`);
  for (const section of SECTIONS) {
    for (const [id, fields] of Object.entries(mod[section] ?? {})) {
      const was = stock[section]?.[id];
      Object.entries(fields).forEach(([field, value], i) => {
        rows.push(`| ${i === 0 ? KIND[section] : ''} | ${i === 0 ? cell(was?.name ?? id) : ''} | ${cell(change(field, value, was))} |`);
      });
    }
  }
  return rows.join('\n');
}

function head(mod) {
  const { json } = mod;
  const links = playLinks(mod.slug, json);
  const out = [`# ${json.name}`, ''];
  if (json.description) out.push(`> ${json.description}`, '');
  out.push(
    links === null
      ? '**Play:** too long for a link. Download [mod.json](mod.json), then in the game choose it under **New game → Mods**.  '
      : `**Play:** [Skirmish](${links.skirmish}) · [Full game](${links.full}) · or download [mod.json](mod.json)  `,
  );
  const facts = [`**Author:** ${json.author ?? 'unnamed'}`, `**Changes:** ${changeCount(json)}`];
  for (const [entry, text] of settings(json)) facts.push(`**${entry}:** ${text.replace(/^Begins in the /, '')}`);
  out.push(facts.join(' · '));
  return out.join('\n');
}

function catalogue(mods) {
  const rows = ['| Mod | What it does | Play |', '|-----|--------------|------|'];
  const refs = [];
  for (const mod of mods) {
    const links = playLinks(mod.slug, mod.json);
    const play = links === null ? `[mod.json](mods/${mod.slug}/mod.json)` : `[Skirmish][${mod.slug}-skirmish] · [Full game][${mod.slug}-full]`;
    rows.push(`| [${cell(mod.json.name)}](mods/${mod.slug}) | ${cell(mod.json.description ?? '')}${badges(mod.json)} | ${play} |`);
    if (links !== null) refs.push(`[${mod.slug}-skirmish]: ${links.skirmish}`, `[${mod.slug}-full]: ${links.full}`);
  }
  return [...rows, '', ...refs].join('\n');
}

/** `text` with the block between `<!-- name:start -->` and `<!-- name:end -->` replaced. */
function fill(text, name, content, file) {
  const start = `<!-- ${name}:start -->`;
  const end = `<!-- ${name}:end -->`;
  const a = text.indexOf(start);
  const b = text.indexOf(end);
  if (a === -1 || b < a) throw new Error(`${relative(ROOT, file)} needs the markers ${start} and ${end}`);
  return `${text.slice(0, a + start.length)}\n${content}\n${text.slice(b)}`;
}

const stock = await fetchStock();
const mods = (await listMods()).filter((m) => m.json !== null);
const stale = [];

async function update(file, transform) {
  const before = await readFile(file, 'utf8');
  const after = transform(before);
  if (after === before) return;
  stale.push(relative(ROOT, file));
  if (!CHECK) await writeFile(file, after);
}

for (const mod of mods) {
  await update(mod.readme, (t) => fill(fill(t, 'head', head(mod), mod.readme), 'changes', changesTable(mod.json, stock), mod.readme));
}
await update(join(ROOT, 'README.md'), (t) => fill(t, 'catalogue', catalogue(mods), join(ROOT, 'README.md')));

if (CHECK && stale.length > 0) {
  console.error(`✗ Out of date: ${stale.join(', ')}\n  Run "npm run catalogue" and commit the result.`);
  process.exit(1);
}
console.log(stale.length === 0 ? '✓ Every generated part is up to date.' : `Rewrote ${stale.join(', ')}.`);
