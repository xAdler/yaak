import { useEffect, useMemo } from "react";
import { jotaiStore } from "../lib/jotai";
import { getKeyValue, setKeyValue } from "../lib/keyValueStore";
import { activeEnvironmentIdsAtom, activeEnvironmentsAtom } from "./useActiveEnvironment";
import { useEnvironmentsBreakdown } from "./useEnvironmentsBreakdown";
import { useKeyValue } from "./useKeyValue";

const kvKey = (workspaceId: string) => `recent_environments::${workspaceId}`;
const namespace = "global";
const fallback: string[] = [];

export function useRecentEnvironments() {
  const { subEnvironments, allEnvironments } = useEnvironmentsBreakdown();
  const kv = useKeyValue<string[]>({
    key: kvKey(allEnvironments[0]?.workspaceId ?? "n/a"),
    namespace,
    fallback,
  });

  const onlyValidIds = useMemo(
    () => kv.value?.filter((id) => subEnvironments.some((e) => e.id === id)) ?? [],
    [kv.value, subEnvironments],
  );

  return onlyValidIds;
}

export function useSubscribeRecentEnvironments() {
  useEffect(() => {
    return jotaiStore.sub(activeEnvironmentIdsAtom, async () => {
      const activeIds = jotaiStore.get(activeEnvironmentIdsAtom);
      if (activeIds.length === 0) return;

      const workspaceId = jotaiStore.get(activeEnvironmentsAtom)[0]?.workspaceId;
      if (workspaceId == null) return;

      const key = kvKey(workspaceId);
      const recentIds = getKeyValue<string[]>({ namespace, key, fallback });

      // Short-circuit if unchanged
      if (
        activeIds.length === recentIds.length &&
        activeIds.every((id, i) => recentIds[i] === id)
      ) return;

      await setKeyValue({ namespace, key, value: activeIds });
    });
  }, []);
}

export async function getRecentEnvironments(workspaceId: string) {
  return getKeyValue<string[]>({
    namespace,
    key: kvKey(workspaceId),
    fallback,
  });
}
