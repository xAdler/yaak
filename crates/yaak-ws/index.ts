import { invoke } from "@tauri-apps/api/core";
import { WebsocketConnection } from "@yaakapp-internal/models";

export function deleteWebsocketConnections(requestId: string) {
  return invoke("cmd_ws_delete_connections", {
    requestId,
  });
}

export function connectWebsocket({
  requestId,
  environmentIds,
  cookieJarId,
}: {
  requestId: string;
  environmentIds: string[];
  cookieJarId: string | null;
}) {
  return invoke("cmd_ws_connect", {
    requestId,
    environmentIds,
    cookieJarId,
  }) as Promise<WebsocketConnection>;
}

export function closeWebsocket({ connectionId }: { connectionId: string }) {
  return invoke("cmd_ws_close", {
    connectionId,
  });
}

export function sendWebsocket({
  connectionId,
  environmentIds,
}: {
  connectionId: string;
  environmentIds: string[];
}) {
  return invoke("cmd_ws_send", {
    connectionId,
    environmentIds,
  });
}
