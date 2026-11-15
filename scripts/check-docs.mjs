// Compares NVIDIA's documents with the fingerprints the data was built from.
// Prints a Markdown summary and exits 1 when a document changed, 2 on a fetch error.
// Used by .github/workflows/doc-watch.yml; run by hand with `npm run docs:check`.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const path = fileURLToPath(new URL('../data/doc-fingerprints.json', import.meta.url));
const { documents } = JSON.parse(readFileSync(path, 'utf8'));
const changed = [];
for (const doc of documents) {
  let res;
  try {
    res = await fetch(doc.url, { redirect: 'follow' });
  } catch (e) {
    console.log(`Could not fetch ${doc.url}: ${e.message}`);
    process.exit(2);
  }
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('pdf')) {
    console.log(`Unexpected response for ${doc.url}: ${res.status} ${res.headers.get('content-type')}`);
    process.exit(2);
  }
  const sha256 = createHash('sha256').update(Buffer.from(await res.arrayBuffer())).digest('hex');
  const lastModified = res.headers.get('last-modified') ?? '';
  if (sha256 !== doc.sha256) changed.push({ ...doc, newSha256: sha256, newLastModified: lastModified });
}
if (changed.length === 0) {
  console.log('NVIDIA documents unchanged.');
  process.exit(0);
}
console.log('NVIDIA changed documents this explorer is built from:\n');
for (const c of changed) {
  console.log(`- **${c.title}**: ${c.url}`);
  console.log(`  - before: last modified ${c.lastModified}, sha256 \`${c.sha256}\``);
  console.log(`  - now: last modified ${c.newLastModified || 'unknown'}, sha256 \`${c.newSha256}\``);
}
console.log('\nRead the new version, update data/nvl72-topology.json and its sources, then update data/doc-fingerprints.json.');
process.exit(1);
