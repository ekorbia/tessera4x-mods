// Prints a mod's Play links, the way the game's Share writes them.
//
//   npm run links -- mods/open-frontier/mod.json

import { readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { LINK_MOST, playLinks } from './lib/mods.mjs';

const path = process.argv[2];
if (path === undefined) {
  console.error('Usage: npm run links -- mods/<your-mod>/mod.json');
  process.exit(2);
}
const file = resolve(path);
const mod = JSON.parse(await readFile(file, 'utf8'));
const links = playLinks(basename(dirname(file)), mod);
if (links === null) {
  console.log(`Too long for a link: over ${LINK_MOST} characters once encoded. Players load it from the file.`);
} else {
  console.log(`Skirmish:  ${links.skirmish}\n\nFull game: ${links.full}\n\n(${links.length} of ${LINK_MOST} characters)`);
}
