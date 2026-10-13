// A JSON Schema checker for the one schema this repo reads: the game's own,
// published at tessera4x.com/mods/schema.json. It knows exactly the keywords
// that schema uses, and refuses to guess at any other: a keyword it has not
// met fails the check by name, so a change to the game's schema can never be
// waved through unchecked.

const ANNOTATIONS = new Set(['$schema', '$id', 'title', 'description', '$comment', 'examples', 'default', '$defs']);
const KNOWN = new Set([
  ...ANNOTATIONS,
  '$ref',
  'type',
  'const',
  'enum',
  'properties',
  'additionalProperties',
  'required',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'items',
  'minItems',
  'maxItems',
  'uniqueItems',
]);

const kindOf = (value) => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
};

const fits = (value, type) => {
  const kind = kindOf(value);
  return kind === type || (type === 'number' && kind === 'integer');
};

const show = (value) => JSON.stringify(value);

/** Edit distance, for "did you mean". */
function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let last = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = next;
    }
  }
  return row[b.length];
}

/** The known key a slip of the keyboard most likely meant, or null when nothing is close. */
function nearest(word, candidates) {
  let best = null;
  let bestDistance = Math.max(2, Math.floor(word.length / 3)) + 1;
  for (const c of candidates) {
    const d = distance(word.toLowerCase(), c.toLowerCase());
    if (d < bestDistance) [best, bestDistance] = [c, d];
  }
  return best;
}

/** Every way `value` breaks `schema`, as "path: what is wrong" lines. */
export function validate(value, schema, root = schema, path = '') {
  const problems = [];
  const at = path === '' ? '(the mod)' : path;
  for (const keyword of Object.keys(schema)) {
    if (!KNOWN.has(keyword)) throw new Error(`The game's schema uses "${keyword}", which scripts/lib/schema.mjs does not check yet.`);
  }
  if (schema.$ref !== undefined) {
    const match = /^#\/\$defs\/(.+)$/.exec(schema.$ref);
    if (match === null || root.$defs?.[match[1]] === undefined) throw new Error(`The game's schema points at ${schema.$ref}, which it does not define.`);
    problems.push(...validate(value, root.$defs[match[1]], root, path));
  }
  if (schema.const !== undefined && value !== schema.const) problems.push(`${at}: must be exactly ${show(schema.const)}`);
  if (schema.enum !== undefined && !schema.enum.includes(value)) problems.push(`${at}: must be one of ${schema.enum.map(show).join(', ')}`);
  if (schema.type !== undefined && !fits(value, schema.type)) {
    problems.push(`${at}: must be ${schema.type === 'integer' ? 'a whole number' : `a ${schema.type}`} (got ${show(value)})`);
    return problems;
  }
  if (typeof value === 'string') {
    const length = [...value].length;
    if (schema.minLength !== undefined && length < schema.minLength) problems.push(`${at}: must not be empty`);
    if (schema.maxLength !== undefined && length > schema.maxLength) {
      problems.push(`${at}: must be at most ${schema.maxLength} characters (this is ${length})`);
    }
  }
  if (typeof value === 'number') {
    if ((schema.minimum !== undefined && value < schema.minimum) || (schema.maximum !== undefined && value > schema.maximum)) {
      problems.push(`${at}: must be from ${schema.minimum ?? '…'} to ${schema.maximum ?? '…'} (got ${value})`);
    }
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) problems.push(`${at}: needs at least ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) problems.push(`${at}: takes at most ${schema.maxItems} items (this has ${value.length})`);
    if (schema.uniqueItems === true) {
      const seen = new Set();
      for (const item of value) {
        const key = show(item);
        if (seen.has(key)) problems.push(`${at}: lists ${key} twice`);
        seen.add(key);
      }
    }
    if (schema.items !== undefined) value.forEach((item, i) => problems.push(...validate(item, schema.items, root, `${path}[${i}]`)));
  }
  if (kindOf(value) === 'object') {
    for (const key of schema.required ?? []) if (!(key in value)) problems.push(`${at}: needs "${key}"`);
    for (const [key, item] of Object.entries(value)) {
      const child = path === '' ? key : `${path}.${key}`;
      const known = schema.properties?.[key];
      if (known !== undefined) problems.push(...validate(item, known, root, child));
      else if (schema.additionalProperties === false) {
        const keys = Object.keys(schema.properties ?? {});
        const near = nearest(key, keys);
        const hint =
          near !== null ? `. Did you mean "${near}"?` : keys.length <= 12 ? `; this one takes ${keys.join(', ')}` : '';
        problems.push(`${child}: not something the game takes here${hint}`);
      }
      else if (typeof schema.additionalProperties === 'object') problems.push(...validate(item, schema.additionalProperties, root, child));
    }
  }
  return problems;
}
