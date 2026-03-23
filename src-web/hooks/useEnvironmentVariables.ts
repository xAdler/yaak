import type { Environment, EnvironmentVariable } from "@yaakapp-internal/models";
import { foldersAtom } from "@yaakapp-internal/models";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { jotaiStore } from "../lib/jotai";
import { isBaseEnvironment, isFolderEnvironment, isSubEnvironment } from "../lib/model_util";
import { useActiveEnvironments } from "./useActiveEnvironment";
import { useActiveRequest } from "./useActiveRequest";
import { useEnvironmentsBreakdown } from "./useEnvironmentsBreakdown";
import { useParentFolders } from "./useParentFolders";

export function useEnvironmentVariables(targetEnvironmentId: string | null) {
  const { baseEnvironments, folderEnvironments, allEnvironments, subEnvironmentsByGroup } =
    useEnvironmentsBreakdown();
  const activeEnvironments = useActiveEnvironments();
  const targetEnvironment = allEnvironments.find((e) => e.id === targetEnvironmentId) ?? null;
  const activeRequest = useActiveRequest();
  const folders = useAtomValue(foldersAtom);
  const activeFolder = folders.find((f) => f.id === targetEnvironment?.parentId) ?? null;
  const parentFolders = useParentFolders(activeFolder ?? activeRequest);

  return useMemo(() => {
    const varMap: Record<string, WrappedEnvironmentVariable> = {};
    const folderVariables = parentFolders.flatMap((f) =>
      wrapVariables(folderEnvironments.find((fe) => fe.parentId === f.id) ?? null),
    );

    // Build variable chain from all groups (sorted by sortPriority).
    // First group variables have lowest priority, last group has highest.
    const groupVariables: WrappedEnvironmentVariable[] = [];
    for (const baseEnv of baseEnvironments) {
      // If editing a sub-env of this group, show its own vars; otherwise show active sub-env
      const activeSubForGroup = activeEnvironments.find((e) =>
        isSubEnvironment(e) && e.parentId === baseEnv.id
      );

      const subEnvVars =
        targetEnvironment != null && isSubEnvironment(targetEnvironment) && targetEnvironment.parentId === baseEnv.id
          ? wrapVariables(targetEnvironment)
          : wrapVariables(activeSubForGroup ?? null);

      groupVariables.push(...subEnvVars, ...wrapVariables(baseEnv));
    }

    // When editing a folder or base env, use group variables; for sub-envs, already handled above
    const activeEnvVariables =
      targetEnvironment == null || // Editing request
      isFolderEnvironment(targetEnvironment) || // Editing folder variables
      isBaseEnvironment(targetEnvironment) // Editing group variables
        ? groupVariables
        : groupVariables; // Sub-env case is handled inside the loop

    const allVariables = [
      ...folderVariables,
      ...activeEnvVariables,
    ];

    for (const v of allVariables) {
      if (!v.variable.enabled || !v.variable.name || v.variable.name in varMap) {
        continue;
      }
      varMap[v.variable.name] = v;
    }

    return Object.values(varMap);
  }, [
    activeEnvironments,
    baseEnvironments,
    folderEnvironments,
    parentFolders,
    targetEnvironment,
    subEnvironmentsByGroup,
  ]);
}

export interface WrappedEnvironmentVariable {
  variable: EnvironmentVariable;
  environment: Environment;
  source: string;
}

function wrapVariables(e: Environment | null): WrappedEnvironmentVariable[] {
  if (e == null) return [];
  const folders = jotaiStore.get(foldersAtom);
  return e.variables.map((v) => {
    const folder = e.parentModel === "folder" ? folders.find((f) => f.id === e.parentId) : null;
    const source = folder?.name ?? e.name;
    return { variable: v, environment: e, source };
  });
}
