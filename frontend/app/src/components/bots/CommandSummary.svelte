<script lang="ts">
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import type { SlashCommandSchema } from "openchat-client";
    import { iconSize } from "../../stores/iconSize";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import CommandBuilder from "./CommandBuilder.svelte";

    interface Props {
        command: SlashCommandSchema;
        onDelete: (cmd: SlashCommandSchema) => void;
    }

    let { command = $bindable(), onDelete }: Props = $props();
    let showBuilder = $state(false);
</script>

{#if showBuilder}
    <CommandBuilder on:close={() => (showBuilder = false)} bind:command></CommandBuilder>
{/if}

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onclick={() => (showBuilder = true)} class="command">
    <div class="name">
        <Translatable resourceKey={i18nKey(`Command: /${command.name}`)}></Translatable>
    </div>
    <div onclick={() => onDelete(command)} class="icon">
        <DeleteOutline viewBox={"0 0 -3 0"} size={$iconSize} color={"var(--button-txt)"} />
    </div>
</div>

<style lang="scss">
    .command {
        cursor: pointer;
        display: flex;
        align-items: center;
        background-color: var(--button-bg);
        color: var(--button-txt);
        transition:
            background ease-in-out 200ms,
            color ease-in-out 200ms;
        border-radius: var(--button-rd);
        margin-bottom: $sp3;

        @media (hover: hover) {
            &:hover {
                background: var(--button-hv);
                color: var(--button-hv-txt);
            }
        }

        .icon {
            flex: 0 0 toRem(30);
            padding: $sp3 $sp4;
        }

        .name {
            padding: $sp3 $sp4;
            flex: auto;
        }
    }
</style>
