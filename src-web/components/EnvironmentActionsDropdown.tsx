import classNames from "classnames";
import type { Environment } from "@yaakapp-internal/models";
import { memo, useMemo } from "react";
import {
  activeEnvironmentIdsAtom,
  getActiveEnvironmentIds,
} from "../hooks/useActiveEnvironment";
import { useEnvironmentsBreakdown } from "../hooks/useEnvironmentsBreakdown";
import { editEnvironment } from "../lib/editEnvironment";
import { jotaiStore } from "../lib/jotai";
import { setWorkspaceSearchParams } from "../lib/setWorkspaceSearchParams";
import type { ButtonProps } from "./core/Button";
import { Button } from "./core/Button";
import type { DropdownItem } from "./core/Dropdown";
import { Dropdown } from "./core/Dropdown";
import { Icon } from "./core/Icon";
import { EnvironmentColorIndicator } from "./EnvironmentColorIndicator";
import { useAtomValue } from "jotai";

type Props = {
  className?: string;
  group: Environment;
} & Pick<ButtonProps, "forDropdown" | "leftSlot">;

export const EnvironmentActionsDropdown = memo(function EnvironmentActionsDropdown({
  className,
  group,
  ...buttonProps
}: Props) {
  const { subEnvironmentsByGroup } = useEnvironmentsBreakdown();
  const activeEnvironmentIds = useAtomValue(activeEnvironmentIdsAtom);
  const groupSubEnvironments = subEnvironmentsByGroup.get(group.id) ?? [];

  // Find the active sub-env for THIS group
  const activeSubEnv = groupSubEnvironments.find((e) => activeEnvironmentIds.includes(e.id));

  const items: DropdownItem[] = useMemo(
    () => [
      ...groupSubEnvironments.map((e) => ({
        key: e.id,
        label: e.name,
        rightSlot: <EnvironmentColorIndicator environment={e} />,
        leftSlot: e.id === activeSubEnv?.id ? <Icon icon="check" /> : <Icon icon="empty" />,
        onSelect: async () => {
          const currentIds = getActiveEnvironmentIds();
          // Remove any existing sub-env for this group
          const otherIds = currentIds.filter(
            (id) => !groupSubEnvironments.some((se) => se.id === id),
          );
          if (e.id !== activeSubEnv?.id) {
            // Activate this sub-env
            setWorkspaceSearchParams({ environment_id: [...otherIds, e.id] });
          } else {
            // Deactivate (toggle off)
            setWorkspaceSearchParams({
              environment_id: otherIds.length > 0 ? otherIds : null,
            });
          }
        },
      })),
      ...((groupSubEnvironments.length > 0
        ? [{ type: "separator", label: group.name }]
        : []) as DropdownItem[]),
      {
        label: "Manage Environments",
        hotKeyAction: "environment_editor.toggle",
        leftSlot: <Icon icon="box" />,
        onSelect: () => editEnvironment(activeSubEnv ?? null),
      },
    ],
    [groupSubEnvironments, activeSubEnv, group.name],
  );

  const hasBaseVars =
    (group.variables ?? []).filter((v) => v.enabled && (v.name || v.value)).length > 0;

  return (
    <Dropdown items={items}>
      <Button
        size="sm"
        className={classNames(
          className,
          "text !px-2 truncate",
          !activeSubEnv && !hasBaseVars && "text-text-subtlest italic",
        )}
        onClick={groupSubEnvironments.length === 0 ? () => editEnvironment(null) : undefined}
        {...buttonProps}
      >
        <EnvironmentColorIndicator environment={activeSubEnv ?? null} />
        {activeSubEnv?.name ?? (hasBaseVars ? group.name : "No Environment")}
      </Button>
    </Dropdown>
  );
});
