Raft's fonts, self-hosted by the web app (and, through `@web/index.css`, by
Raft Desktop on its `app://raft` origin). `src/fonts.css` declares them and is imported first by
`src/index.css` in place of `@botiverse/raft-ui/fonts.css`, which loads the same
families from Google Fonts.

- `inter-{latin,latin-ext,vietnamese}.woff2` (variable, 100..900) and
  `ibm-plex-mono-{latin,latin-ext,vietnamese}-{400,500,700}.woff2`: the files the
  Google Fonts css2 request in raft-ui's fonts.css
  (`family=Inter:wght@100..900&family=IBM+Plex+Mono:wght@400;500;700&display=swap`)
  serves to Chrome, fetched 2026-11-18, with Google's unicode ranges and
  `font-display: swap` unchanged. Inter replaced Space Grotesk and IBM Plex Mono
  replaced Space Mono in the 2026-11 redesign (Figma 精修 · 组件化, Typography).

All are licensed under the SIL Open Font License 1.1 (inter-OFL.txt,
ibmplexmono-OFL.txt), which permits bundling and
redistribution with the app.

Updating: re-request the css2 URL raft-ui's fonts.css uses with a current Chrome
user agent, download every subset, keep the unicode ranges, and re-copy the font
variables from the raft-ui version this package depends on
(`tests/fontsCss.test.ts` fails when they drift).

Share images (`src/utils/selectScreenshotFonts.ts`) embed these faces as data
URLs, because the SVG image they are rasterized from cannot reach page fonts.
It embeds the families in its `SCREENSHOT_FONT_FAMILIES` list, from this origin
only: keep that list in step when a family is added or renamed here, and keep
the files small (all of them are fetched once per session, ~210 KB today).
