import { setWindowTitle } from "@yaakapp-internal/mac-window";
import { settingsAtom } from "@yaakapp-internal/models";
import { useAtomValue } from "jotai";
import { useEffect } from "react";
import { appInfo } from "../lib/appInfo";
import { jotaiStore } from "../lib/jotai";
import { resolvedModelName } from "../lib/resolvedModelName";
import { useActiveEnvironments } from "./useActiveEnvironment";
import { activeRequestAtom } from "./useActiveRequest";
import { activeWorkspaceAtom } from "./useActiveWorkspace";

export function useSyncWorkspaceRequestTitle() {
  const activeWorkspace = useAtomValue(activeWorkspaceAtom);
  const activeEnvironments = useActiveEnvironments();
  const activeRequest = useAtomValue(activeRequestAtom);

  useEffect(() => {
    const settings = jotaiStore.get(settingsAtom);
    let newTitle = activeWorkspace ? activeWorkspace.name : "Yaak";
    if (activeEnvironments.length > 0) {
      newTitle += ` (${activeEnvironments.map((e) => e.name).join(", ")})`;
    }

    if (!settings.useNativeTitlebar && activeRequest) {
      newTitle += ` › ${resolvedModelName(activeRequest)}`;
    }

    if (appInfo.isDev) {
      newTitle = `[DEV] ${newTitle}`;
    }

    setWindowTitle(newTitle);
  }, [activeEnvironments, activeRequest, activeWorkspace]);
}
