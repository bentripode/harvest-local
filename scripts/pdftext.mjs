/**
 * Pull the text out of a statute PDF.
 *
 * Most of the compliance data in this repo comes from reading primary law, and a good deal of that
 * law is published only as PDF — enrolled acts, code volumes, session laws. Twice now a state has
 * been left unverified in `state_label_rules` not because the text was hard to find but because it
 * would not come out of the file: Arkansas Act 1040 of 2021 and the Colorado Revised Statutes both
 * download cleanly and yielded nothing but their title pages.
 *
 * The reason was the extractor, not the documents. A PDF only looks like text. Legislative
 * typesetters routinely emit:
 *
 *   - hex strings (`<0041004200430044> Tj`) rather than `(literal) Tj`;
 *   - Type0 / CID fonts, where the bytes in the content stream are glyph ids that mean nothing
 *     without the font's ToUnicode CMap;
 *   - cross-reference streams and object streams, so the page tree is itself compressed;
 *   - filters other than FlateDecode, and Flate with PNG predictors.
 *
 * pdf.js handles all of that, so this defers to it rather than growing another hand-rolled parser.
 *
 * Usage:
 *   node scripts/pdftext.mjs <file.pdf>                       first 3000 characters
 *   node scripts/pdftext.mjs <file.pdf> --dump <out.txt>      whole text to a file
 *   node scripts/pdftext.mjs <file.pdf> "<regex>" [before] [after]   matching excerpts
 *
 * The regex form is the one to reach for when checking a citation: it prints each match in context,
 * which is what you need to tell a statute that really says something from a page that merely links
 * to the section that does.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pdfjs = require("pdfjs-dist/legacy/build/pdf.mjs");

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/pdftext.mjs <file.pdf> [--dump <out.txt> | <regex>]");
  process.exit(1);
}

const doc = await pdfjs.getDocument({
  data: new Uint8Array(readFileSync(file)),
  // Nothing here needs to render, and skipping the font machinery keeps a 1,400-page code volume
  // to a couple of minutes.
  disableFontFace: true,
  useSystemFonts: false,
  verbosity: 0,
}).promise;

const pages = [];
for (let n = 1; n <= doc.numPages; n++) {
  const content = await (await doc.getPage(n)).getTextContent();
  let out = "";
  for (const item of content.items) {
    if (item.str === undefined) continue;
    out += item.str;
    // A line break inside a statutory sentence is noise when you are searching for a phrase, so an
    // end-of-line becomes a space. The page break survives, below.
    if (item.hasEOL) out += " ";
  }
  pages.push(out);
}

const text = pages.join("\n").replace(/\s+/g, " ").trim();

const mode = process.argv[3];

if (mode === "--dump") {
  const out = process.argv[4];
  if (!out) {
    console.error("--dump needs an output path");
    process.exit(1);
  }
  writeFileSync(out, text, "utf8");
  console.log(`wrote ${text.length} chars to ${out}`);
} else if (!mode) {
  console.log(`pages: ${doc.numPages}  chars: ${text.length}`);
  console.log(text.slice(0, 3000));
} else {
  const before = Number(process.argv[4] || 260);
  const after = Number(process.argv[5] || 900);
  const re = new RegExp(mode, "gi");
  let m;
  let hits = 0;
  while ((m = re.exec(text)) && hits < 12) {
    console.log("..." + text.slice(Math.max(0, m.index - before), m.index + after) + "...\n---");
    hits++;
  }
  // Say how many, not just whether: a single mention is usually a cross-reference, while a document
  // that is ABOUT a section repeats its number. That distinction has produced false positives here
  // before.
  const total = (text.match(new RegExp(mode, "gi")) || []).length;
  console.log(hits ? `${total} match(es) for /${mode}/` : `no match for /${mode}/. chars=${text.length}`);
}
