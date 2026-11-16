import assert from "node:assert/strict";
import { act } from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { asArtifactId } from "@botiverse/raft-shared";
import { useArtifactViewerStore } from "../src/apps/artifacts/artifactViewerStore";
import { useArtifactViewerAddress } from "../src/components/layout/artifactViewerAddress";
import { readArtifactAddress } from "../src/components/layout/artifactOpenAddress";

/**
 * The workspace's tabs and the address (anxndsgn 11/16): closing the shown tab of two showed the other, and closing
 * that one went Back onto the first's entry and opened it again.
 */
function Sync() {
  useArtifactViewerAddress();
  return null;
}

const A = asArtifactId("pt_4a2995eb-648e-cbda-356e-72f4f0fca1af");
const B = asArtifactId("pt_5267185a-e182-37d6-027a-b89e6118b3a6");
const artifactParam = () => readArtifactAddress(new URLSearchParams(window.location.search))?.id ?? null;

test("closing the workspace's tabs one by one never brings a closed one back", async () => {
  window.history.replaceState(null, "", "/s/dev/channel/c1");
  useArtifactViewerStore.setState({ open: null, tabs: [], tabTitles: {} });
  window.localStorage.clear();
  render(<BrowserRouter><Sync /></BrowserRouter>);
  const store = () => useArtifactViewerStore.getState();

  act(() => store().openArtifact({ id: A, version: null, source: "message", conversationId: "c1" } as never));
  await waitFor(() => assert.equal(artifactParam(), A));
  act(() => store().openArtifact({ id: B, version: null, source: "message", conversationId: "c1" } as never));
  await waitFor(() => assert.equal(artifactParam(), B));

  // Close B: A shows, in B's entry's place.
  act(() => store().close());
  await new Promise((resolve) => setTimeout(resolve, 200));
  await waitFor(() => assert.equal(artifactParam(), A));
  assert.equal(store().open?.id, A);

  // Close A: the workspace closes and stays closed (B is not opened again, nor A).
  act(() => store().close());
  await waitFor(() => assert.equal(store().open, null));
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(store().open, null, `reopened ${store().open?.id}`);
  assert.deepEqual(store().tabs, []);
  assert.equal(artifactParam(), null);
  cleanup();
});
