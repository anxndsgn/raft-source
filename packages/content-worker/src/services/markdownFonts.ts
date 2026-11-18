/**
 * Raft's fonts for a Markdown page (markdown.ts, `MARKDOWN_FONT_FACES`), carried in the Worker's
 * bundle (wrangler.jsonc's `*.woff2` rule) and served beside the page under the version as
 * `_raft-fonts/<file>`, as the PDF viewer's files are (pdfViewer.ts): from the page's own origin,
 * under the frame's CSP as it is (its `font-src` is open to the version's own files), with
 * Porthole's headers for a version's file (`font/woff2`, its ETag, `immutable` once sealed).
 *
 * The files are the web's (packages/web/src/assets/fonts, Google Fonts' Inter and IBM
 * Plex Mono), byte for byte (test/markdown-fonts.test.ts). Both are under the SIL Open Font License
 * 1.1 (../fonts/inter-OFL.txt, ../fonts/ibmplexmono-OFL.txt), which permits bundling them.
 */
import interLatinExt from "../fonts/inter-latin-ext.woff2";
import interLatin from "../fonts/inter-latin.woff2";
import plexMonoLatinExt400 from "../fonts/ibm-plex-mono-latin-ext-400.woff2";
import plexMonoLatin400 from "../fonts/ibm-plex-mono-latin-400.woff2";
import plexMonoLatinExt700 from "../fonts/ibm-plex-mono-latin-ext-700.woff2";
import plexMonoLatin700 from "../fonts/ibm-plex-mono-latin-700.woff2";
import { MARKDOWN_FONTS_DIR, MARKDOWN_FONT_FACES } from "../markdown";

const BYTES: Record<(typeof MARKDOWN_FONT_FACES)[number]["file"], ArrayBuffer> = {
  "inter-latin-ext.woff2": interLatinExt,
  "inter-latin.woff2": interLatin,
  "ibm-plex-mono-latin-ext-400.woff2": plexMonoLatinExt400,
  "ibm-plex-mono-latin-400.woff2": plexMonoLatin400,
  "ibm-plex-mono-latin-ext-700.woff2": plexMonoLatinExt700,
  "ibm-plex-mono-latin-700.woff2": plexMonoLatin700,
};

type Asset = { readonly bytes: Uint8Array; readonly sha256: string };
let assets: ReadonlyMap<string, Asset> | null = null;

/** The fonts by their path in the version (made once per isolate, when a Markdown page is first served). */
export function markdownFontFiles(): ReadonlyMap<string, Asset> {
  if (assets === null) {
    assets = new Map(
      MARKDOWN_FONT_FACES.map(({ file, sha256 }) => [`${MARKDOWN_FONTS_DIR}${file}`, { bytes: new Uint8Array(BYTES[file]), sha256 }]),
    );
  }
  return assets;
}
