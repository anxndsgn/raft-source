# Vendored raft-ui

Copied 1:1 from [botiverse/raft-design](https://github.com/botiverse/raft-design)
`packages/ui` at tag `v0.95.3` (commit `a5ce3c2`), so Raft can edit its design
system in place instead of overriding styles.

Changes from upstream, all in `package.json` only:
- `catalog:` and `workspace:` versions written out as the versions raft-design
  pins at that tag (`@botiverse/ricons` stays on npm, `^0.1.1`).
- `private: true`, no `publishConfig`: this copy is not published.
- `prepare: vp pack`, so `pnpm install` builds `dist/`, which the web reads
  exactly as it read the npm package.

At this tag, `vp pack` here produces a `dist/` byte-identical to the published
`@botiverse/raft-ui@0.95.3`.

## v0.102.11 (raft-customized, upstream Raft v1.33.1 merge)

The web from Raft v1.33.1 is written against `@botiverse/raft-ui@0.102.11`. The
raft-design changes `v0.101.0..v0.102.11` (`packages/ui`) were merged into this
copy file by file (three-way, base v0.101.0), keeping the redesign's changes.
Conflicts: `dropdown-menu.tsx` and `select.tsx` (the phone's bottom sheet kept,
upstream's hidden-anchor classes added), `message-item.recipe.ts`, `package.json`
(versions written out; `@botiverse/lint` added), `prefer-scroll-area.test.ts`
(ours), docs (upstream's).
