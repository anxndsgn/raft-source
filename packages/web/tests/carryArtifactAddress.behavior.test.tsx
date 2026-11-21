import { test } from "vitest";
import assert from "node:assert/strict";
import { carryArtifactAddress, readArtifactAddress, withArtifactAddress } from "../src/components/layout/artifactOpenAddress";
import { asArtifactId } from "@botiverse/raft-shared";

// owner 1b934a9e: opening a task's source message closed the Artifact open in the workspace, because the message's
// address had no Artifact in it. A message in the same conversation carries the open Artifact on.
const A = asArtifactId("pt_4a2995eb-648e-cbda-356e-72f4f0fca1af");
const here = `?${withArtifactAddress(new URLSearchParams(), { id: A, version: 3 }).toString()}`;

test("a message in the same conversation keeps the open Artifact", () => {
  const next = carryArtifactAddress("/s/dev/channel/c1?msg=m1", "/s/dev/channel/c1", here);
  const params = new URLSearchParams(next.split("?")[1]);
  assert.equal(params.get("msg"), "m1");
  assert.equal(readArtifactAddress(params)?.id, A);
});

test("a message elsewhere does not take it along", () => {
  assert.equal(carryArtifactAddress("/s/dev/channel/c2?msg=m1", "/s/dev/channel/c1", here), "/s/dev/channel/c2?msg=m1");
});

test("with no Artifact open the address is the message's", () => {
  assert.equal(carryArtifactAddress("/s/dev/channel/c1?msg=m1", "/s/dev/channel/c1", ""), "/s/dev/channel/c1?msg=m1");
});
