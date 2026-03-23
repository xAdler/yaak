import { useSearch } from "@tanstack/react-router";
import type { Environment } from "@yaakapp-internal/models";
import { environmentsAtom } from "@yaakapp-internal/models";
import { atom, useAtomValue } from "jotai";
import { useEffect } from "react";
import { environmentsBreakdownAtom } from "./useEnvironmentsBreakdown";
import { jotaiStore } from "../lib/jotai";

/** Array of active sub-environment IDs (one per group) */
export const activeEnvironmentIdsAtom = atom<string[]>([]);

/** @deprecated Use activeEnvironmentIdsAtom for multi-group support */
export const activeEnvironmentIdAtom = atom<string | undefined>((get) => {
  return get(activeEnvironmentIdsAtom)[0];
});

/** All active sub-environments (one per group), sorted by parent group's sortPriority */
export const activeEnvironmentsAtom = atom<Environment[]>((get) => {
  const ids = get(activeEnvironmentIdsAtom);
  const allEnvs = get(environmentsAtom);
  const { baseEnvironments } = get(environmentsBreakdownAtom);

  const envs = ids
    .map((id) => allEnvs.find((e) => e.id === id))
    .filter((e): e is Environment => e != null);

  // Sort by parent group's position (sortPriority order)
  const groupOrder = new Map(baseEnvironments.map((g, i) => [g.id, i]));
  return envs.sort((a, b) => {
    const aOrder = groupOrder.get(a.parentId ?? "") ?? 0;
    const bOrder = groupOrder.get(b.parentId ?? "") ?? 0;
    return aOrder - bOrder;
  });
});

/** First active environment (backward compat) */
export const activeEnvironmentAtom = atom<Environment | null>((get) => {
  return get(activeEnvironmentsAtom)[0] ?? null;
});

export function useActiveEnvironment() {
  return useAtomValue(activeEnvironmentAtom);
}

export function useActiveEnvironments() {
  return useAtomValue(activeEnvironmentsAtom);
}

export function getActiveEnvironment() {
  return jotaiStore.get(activeEnvironmentAtom);
}

export function getActiveEnvironmentIds(): string[] {
  return jotaiStore.get(activeEnvironmentIdsAtom);
}

export function useSubscribeActiveEnvironmentId() {
  const { environment_id } = useSearch({ strict: false });
  useEffect(() => {
    const ids = normalizeEnvironmentIds(environment_id);
    jotaiStore.set(activeEnvironmentIdsAtom, ids);
  }, [environment_id]);
}

/** Normalize environment_id from URL params (can be string, string[], or null) to string[] */
function normalizeEnvironmentIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string") return [value];
  return [];
}
