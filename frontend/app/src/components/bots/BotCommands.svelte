<script lang="ts">
    import {
        hasEveryRequiredPermission,
        type ExternalBotPermissions,
        type SlashCommandSchema,
    } from "openchat-client";
    import TooltipWrapper from "../TooltipWrapper.svelte";
    import TooltipPopup from "../TooltipPopup.svelte";

    interface Props {
        grantedPermissions: ExternalBotPermissions;
        commands: SlashCommandSchema[];
        centered?: boolean;
    }

    let { grantedPermissions, commands, centered = false }: Props = $props();
</script>

<div class="commands" class:centered>
    {#each commands as command}
        <TooltipWrapper position="bottom" align="middle">
            <div
                slot="target"
                class="command"
                class:not_permitted={!hasEveryRequiredPermission(
                    command.permissions,
                    grantedPermissions,
                )}>
                {command.name}
            </div>
            <div let:position let:align slot="tooltip">
                <TooltipPopup {align} {position}>
                    {command.description}
                </TooltipPopup>
            </div>
        </TooltipWrapper>
    {/each}
</div>

<style lang="scss">
    .commands {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: $sp3;
        margin-bottom: $sp4;

        &.centered {
            justify-content: center;
        }

        .command {
            @include font(light, normal, fs-80);
            background-color: var(--button-bg);
            border: 1px solid var(--button-bg);
            color: var(--button-txt);
            padding: $sp2 $sp3;
            border-radius: $sp2;
            cursor: pointer;

            &.not_permitted {
                background-color: unset;
                color: var(--txt);
                opacity: 0.8;
            }
        }
    }
</style>
