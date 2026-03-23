import type { Environment } from "@yaakapp-internal/models";
import { environmentsAtom } from "@yaakapp-internal/models";
import { atom, useAtomValue } from "jotai";

export const environmentsBreakdownAtom = atom((get) => {
  const allEnvironments = get(environmentsAtom);

  // Base environments (groups), sorted by sortPriority
  const baseEnvironments = [...allEnvironments.filter((e) => e.parentModel === "workspace")].sort(
    (a, b) => {
      if (a.sortPriority === b.sortPriority) {
        return a.updatedAt > b.updatedAt ? 1 : -1;
      }
      return a.sortPriority - b.sortPriority;
    },
  );

  const subEnvironments =
    allEnvironments
      .filter((e) => e.parentModel === "environment")
      ?.sort((a, b) => {
        if (a.sortPriority === b.sortPriority) {
          return a.updatedAt > b.updatedAt ? 1 : -1;
        }
        return a.sortPriority - b.sortPriority;
      }) ?? [];

  // Sub-environments grouped by their parent (group) ID
  const subEnvironmentsByGroup = new Map<string, Environment[]>();
  for (const env of subEnvironments) {
    const groupId = env.parentId;
    if (groupId == null) continue;
    const group = subEnvironmentsByGroup.get(groupId) ?? [];
    group.push(env);
    subEnvironmentsByGroup.set(groupId, group);
  }

  const folderEnvironments =
    allEnvironments.filter((e) => e.parentModel === "folder" && e.parentId != null) ?? [];

  const baseEnvironment = baseEnvironments[0] ?? null;
  return {
    allEnvironments,
    baseEnvironment,
    subEnvironments,
    subEnvironmentsByGroup,
    folderEnvironments,
    baseEnvironments,
  };
});

export function useEnvironmentsBreakdown() {
  return useAtomValue(environmentsBreakdownAtom);
}
