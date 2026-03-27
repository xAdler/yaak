// Create a new router instance
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "../routeTree.gen";

/** Serialize search params using standard repeated query params for arrays
 *  (e.g. ?environment_id=a&environment_id=b) instead of TanStack Router's
 *  default JSON encoding (e.g. ?environment_id=["a","b"]). The Rust side
 *  reads these via url.query_pairs() which expects the repeated format. */
function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(search)) {
    if (val === undefined || val === null) continue;
    if (Array.isArray(val)) {
      for (const item of val) {
        params.append(key, String(item));
      }
    } else {
      params.set(key, String(val));
    }
  }
  const str = params.toString();
  return str ? `?${str}` : "";
}

export const router = createRouter({ routeTree, stringifySearch });

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
