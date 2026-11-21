/**
 * The Artifact an address opens, as its parameters (artifactLinks ARTIFACT_OPEN_*, searchContentStore
 * SEARCH_OPEN_REVIEW_PARAM). Kept here, with no imports, so a navigation helper can carry them without loading the
 * stores those modules pull in (they need a browser's storage).
 */
const ARTIFACT_ADDRESS_PARAMS = ["artifact", "version", "from", "review"] as const;

/**
 * `target` with the Artifact open in the address on screen, where both are the same conversation; else `target`
 * (owner 1b934a9e: a task's source message closed the workspace's Artifact).
 */
export function carryArtifactAddress(target: string, herePathname: string, hereSearch: string): string {
  const here = new URLSearchParams(hereSearch);
  if (!here.get("artifact")) return target;
  const [pathname, query = ""] = target.split("?");
  if (pathname !== herePathname) return target;
  const params = new URLSearchParams(query);
  for (const name of ARTIFACT_ADDRESS_PARAMS) {
    const value = here.get(name);
    if (value === null) params.delete(name);
    else params.set(name, value);
  }
  return `${pathname}?${params.toString()}`;
}
