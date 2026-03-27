import { useEnvironmentVariables } from "./useEnvironmentVariables";

export function useActiveEnvironmentVariables() {
  return useEnvironmentVariables(null).map((v) => v.variable);
}
