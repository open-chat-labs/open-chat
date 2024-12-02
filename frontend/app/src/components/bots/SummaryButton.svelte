<script lang="ts">
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import { iconSize } from "../../stores/iconSize";
    import Translatable from "../Translatable.svelte";
    import type { ResourceKey } from "openchat-client";

    interface Props {
        resourceKey: ResourceKey;
        valid: boolean;
        onDelete: () => void;
        onSelect: () => void;
    }

    let { onDelete, onSelect, resourceKey, valid }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onclick={onSelect} class:invalid={!valid} class="command">
    <div class="name">
        <Translatable {resourceKey}></Translatable>
    </div>
    <div
        onclick={(e) => {
            e.stopPropagation();
            onDelete();
        }}
        class="icon">
        <DeleteOutline viewBox={"0 -3 24 24"} size={$iconSize} color={"var(--button-txt)"} />
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

        &.invalid {
            background-color: var(--error);
            @media (hover: hover) {
                &:hover {
                    background: var(--error);
                }
            }
        }
    }
</style>
