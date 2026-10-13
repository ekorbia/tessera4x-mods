// What the scripts share: where the mods live, the game's published files,
// and the Play links. Nothing here is copied from the game: the schema and
// the brief are read from tessera4x.com each run, so they can't fall behind.

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const MODS_DIR = join(ROOT, 'mods');

/** Where the schema and the brief are read from. Point it at a local build with TESSERA4X_SITE. */
export const SITE = (process.env.TESSERA4X_SITE ?? 'https://tessera4x.com').replace(/\/$/, '');

/** Where Play links open. Fixed, so the generated files are the same wherever they are made. */
export const PLAY_SITE = 'https://tessera4x.com';

/** The game's own limit on a mod carried in a link, encoded. */
export const LINK_MOST = 6000;

export const SECTIONS = ['units', 'buildings', 'wonders', 'techs', 'civs', 'terrain', 'features'];
export const VICTORIES = ['concord', 'meridian', 'laurelArch'];

/** A file from the game's site, or a clear failure. */
export async function fetchText(path) {
  const url = `${SITE}${path}`;
  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  } catch (error) {
    throw new Error(`Couldn't reach ${url}: ${error.message}`);
  }
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.text();
}

export async function fetchSchema() {
  return JSON.parse(await fetchText('/mods/schema.json'));
}

/** Every mod folder, with its file read and parsed where it parses. */
export async function listMods() {
  const entries = await readdir(MODS_DIR, { withFileTypes: true });
  const mods = [];
  for (const entry of entries.filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const dir = join(MODS_DIR, entry.name);
    const file = join(dir, 'mod.json');
    const mod = { slug: entry.name, dir, file, readme: join(dir, 'README.md'), text: null, json: null, parseError: null };
    if (existsSync(file)) {
      mod.text = await readFile(file, 'utf8');
      try {
        mod.json = JSON.parse(mod.text);
      } catch (error) {
        mod.parseError = error.message;
      }
    }
    mods.push(mod);
  }
  return mods;
}

/** How many things a mod changes, counted as the game counts them: each field, the start, each victory switched off. */
export function changeCount(mod) {
  let n = 0;
  for (const section of SECTIONS) for (const fields of Object.values(mod[section] ?? {})) n += Object.keys(fields).length;
  if (mod.startEra !== undefined) n++;
  n += VICTORIES.filter((v) => mod.victories?.[v] === false).length;
  return n;
}

/** A seed for a mod's Play links, fixed by its folder name (32-bit FNV-1a), so everyone plays the same world. */
export function seedFor(slug) {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(slug)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** The mod as link text: its JSON, compact, as base64url, the way the game's Share writes it. */
export function encodeMod(mod) {
  return Buffer.from(JSON.stringify(mod), 'utf8').toString('base64url');
}

/**
 * A mod's two Play links: a skirmish, and a full game on the game's default
 * settings. Null when the mod is too long to travel in a link.
 */
export function playLinks(slug, mod) {
  const encoded = encodeMod(mod);
  if (encoded.length > LINK_MOST) return null;
  const seed = seedFor(slug);
  return {
    skirmish: `${PLAY_SITE}/#world=skirmish&seed=${seed}&mod=${encoded}`,
    full: `${PLAY_SITE}/#world=custom&seed=${seed}&mod=${encoded}`,
    length: encoded.length,
  };
}

/**
 * The game's own values, read from the brief it publishes: section → id →
 * { name, values }. Each entry's line reads "settler — Settler: cost 106,
 * moves 2, sight 2"; yields read "yields food 2 production 0 gold 0".
 */
export async function fetchStock() {
  const brief = await fetchText('/mods/brief.txt');
  const stock = Object.fromEntries(SECTIONS.map((s) => [s, {}]));
  let section = null;
  let listing = false;
  for (const line of brief.split('\n')) {
    const header = /^== .* \("(\w+)"\) ==$/.exec(line);
    if (header !== null) {
      section = SECTIONS.includes(header[1]) ? header[1] : null;
      listing = false;
      continue;
    }
    // Each section lists its fields first, then — after "Every unit, as id — name: …" — its entries.
    if (line.startsWith('Every ')) listing = true;
    const entry = section === null || !listing ? null : /^ {2}(\w+) — (.+?)(?:: (.+))?$/.exec(line);
    if (entry === null) continue;
    const values = {};
    for (const part of (entry[3] ?? '').split(', ').filter(Boolean)) {
      const [field, ...rest] = part.split(' ');
      if (field === 'yields') {
        values.yields = {};
        for (let i = 0; i + 1 < rest.length; i += 2) values.yields[rest[i]] = Number(rest[i + 1]);
      } else if (field === 'cityNames') {
        values.cityNames = `${rest[0]} names`;
      } else {
        values[field] = rest.length === 1 && /^-?\d+$/.test(rest[0]) ? Number(rest[0]) : rest.join(' ');
      }
    }
    stock[section][entry[1]] = { name: entry[2], values };
  }
  if (Object.keys(stock.units).length === 0) throw new Error('The brief at /mods/brief.txt no longer lists units the way this script reads them.');
  return stock;
}

export const ERA_NAMES = {
  ancient: 'Ancient',
  classical: 'Classical',
  medieval: 'Medieval',
  renaissance: 'Renaissance',
  industrial: 'Industrial',
  modern: 'Modern',
};

export const VICTORY_NAMES = { concord: 'the Concord', meridian: 'the Meridian', laurelArch: 'the Laurel Arch' };

/** "a", "a and b", "a, b and c". */
export const listed = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);
