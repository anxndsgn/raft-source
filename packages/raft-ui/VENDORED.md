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
