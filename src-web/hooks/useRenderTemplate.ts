import { useQuery } from "@tanstack/react-query";
import type { RenderPurpose } from "@yaakapp-internal/plugins";
import { useAtomValue } from "jotai";
import { minPromiseMillis } from "../lib/minPromiseMillis";
import { invokeCmd } from "../lib/tauri";
import { activeEnvironmentIdsAtom } from "./useActiveEnvironment";
import { activeWorkspaceIdAtom } from "./useActiveWorkspace";

export function useRenderTemplate({
  template,
  enabled,
  purpose,
  refreshKey,
  ignoreError,
  preservePreviousValue,
}: {
  template: string;
  enabled: boolean;
  purpose: RenderPurpose;
  refreshKey?: string | null;
  ignoreError?: boolean;
  preservePreviousValue?: boolean;
}) {
  const workspaceId = useAtomValue(activeWorkspaceIdAtom) ?? "n/a";
  const environmentIds = useAtomValue(activeEnvironmentIdsAtom);
  return useQuery<string>({
    refetchOnWindowFocus: false,
    enabled,
    placeholderData: preservePreviousValue ? (prev) => prev : undefined,
    queryKey: ["render_template", workspaceId, environmentIds, refreshKey, purpose, ignoreError],
    queryFn: () =>
      minPromiseMillis(
        renderTemplate({ template, workspaceId, environmentIds, purpose, ignoreError }),
        300,
      ),
  });
}

export async function renderTemplate({
  template,
  workspaceId,
  environmentIds,
  purpose,
  ignoreError,
}: {
  template: string;
  workspaceId: string;
  environmentIds: string[];
  purpose: RenderPurpose;
  ignoreError?: boolean;
}): Promise<string> {
  return invokeCmd("cmd_render_template", {
    template,
    workspaceId,
    environmentIds,
    purpose,
    ignoreError,
  });
}

export async function decryptTemplate({
  template,
  workspaceId,
  environmentIds,
}: {
  template: string;
  workspaceId: string;
  environmentIds: string[];
}): Promise<string> {
  return invokeCmd("cmd_decrypt_template", { template, workspaceId, environmentIds });
}
