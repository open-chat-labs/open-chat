<script lang="ts">
    import { Chip, Container, Tooltip } from "component-lib";
    import {
        commandSupportsDirectMessages,
        hasEveryRequiredPermission,
        ROLE_ADMIN,
        type CommandDefinition,
        type GrantedBotPermissions,
    } from "openchat-client";
    import ShieldAccount from "svelte-material-icons/ShieldAccount.svelte";
    import SwapHorizontal from "svelte-material-icons/SwapHorizontal.svelte";

    interface Props {
        grantedPermissions?: GrantedBotPermissions;
        commands: CommandDefinition[];
        centered?: boolean;
        onClick?: (command: CommandDefinition, index: number) => void;
    }

    let { grantedPermissions, commands, onClick }: Props = $props();
</script>

{#snippet shield(color: string)}
    <ShieldAccount {color} />
{/snippet}

{#snippet swap(color: string)}
    <SwapHorizontal {color} />
{/snippet}

<Container wrap gap={"sm"}>
    {#each commands as command, i}
        {@const permitted =
            grantedPermissions?.command === undefined ||
            hasEveryRequiredPermission(command.permissions, grantedPermissions.command)}
        <Tooltip position="bottom" align="middle">
            <Chip
                mode={permitted ? "filter" : "default"}
                onClick={onClick && permitted ? () => onClick(command, i) : undefined}
                icon={command.defaultRole >= ROLE_ADMIN
                    ? shield
                    : commandSupportsDirectMessages(command)
                      ? swap
                      : undefined}>
                {`/${command.name}`}
            </Chip>
            {#snippet popup()}
                {command.description}
            {/snippet}
        </Tooltip>
    {/each}
</Container>
