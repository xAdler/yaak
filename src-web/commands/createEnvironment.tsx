import type { Environment } from "@yaakapp-internal/models";
import { environmentsAtom } from "@yaakapp-internal/models";
import { CreateEnvironmentDialog } from "../components/CreateEnvironmentDialog";
import { getActiveEnvironmentIds } from "../hooks/useActiveEnvironment";
import { activeWorkspaceIdAtom } from "../hooks/useActiveWorkspace";
import { createFastMutation } from "../hooks/useFastMutation";
import { showDialog } from "../lib/dialog";
import { jotaiStore } from "../lib/jotai";
import { setWorkspaceSearchParams } from "../lib/setWorkspaceSearchParams";

export const createSubEnvironmentAndActivate = createFastMutation<
  { id: string; groupId: string } | null,
  unknown,
  Environment | null
>({
  mutationKey: ["create_environment"],
  mutationFn: async (baseEnvironment) => {
    if (baseEnvironment == null) {
      throw new Error("No base environment passed");
    }

    const workspaceId = jotaiStore.get(activeWorkspaceIdAtom);
    if (workspaceId == null) {
      throw new Error("Cannot create environment when no active workspace");
    }

    return new Promise<{ id: string; groupId: string } | null>((resolve) => {
      showDialog({
        id: "new-environment",
        title: "New Environment",
        description: "Create multiple environments with different sets of variables",
        size: "sm",
        onClose: () => resolve(null),
        render: ({ hide }) => (
          <CreateEnvironmentDialog
            workspaceId={workspaceId}
            groupId={baseEnvironment.id}
            hide={hide}
            onCreate={(id: string) => {
              resolve({ id, groupId: baseEnvironment.id });
            }}
          />
        ),
      });
    });
  },
  onSuccess: async (result) => {
    if (result == null) {
      return; // Was not created
    }

    // Replace the active sub-env for this group, keep others
    const currentIds = getActiveEnvironmentIds();
    const allEnvs = jotaiStore.get(environmentsAtom);
    const groupSubEnvIds = new Set(
      allEnvs
        .filter((e) => e.parentModel === "environment" && e.parentId === result.groupId)
        .map((e) => e.id),
    );
    const otherIds = currentIds.filter((id) => !groupSubEnvIds.has(id));
    setWorkspaceSearchParams({ environment_id: [...otherIds, result.id] });
  },
});
