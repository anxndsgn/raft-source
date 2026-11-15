# @botiverse/raft-ui-ext

Raft Chat's own components, built to the raft-design specs but not part of raft-ui (anxndsgn, 2026-11-15):
the official `@botiverse/raft-ui` stays as published; what our layout redesign needs that raft-ui doesn't have
lives here, in raft-ui's style (its tokens, its parts). The spec of each is in raft-design, which points back here;
change both together.

| Component | Spec (raft-design) |
| --- | --- |
| `RegionDrawer`, `RegionDrawerHandle` | `packages/ui/src/components/drawer/drawer.md` › A drawer over one region |
| `SourceBar`, `SourceBarText`, `SourceBarActions` | `packages/ui/src/components/tabs/tabs.md` › Where a tab's content came from |
| `TaskSectionRow` | `design/patterns/tasks.md` › Rows in the Tasks section |

The web app's Tailwind scans `src/` here (`packages/web/src/index.css` `@source`).
