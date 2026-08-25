<script lang="ts">
    import type { Snippet } from "svelte";

    interface Props {
        id: string;
        ticks: Record<string, boolean>;
        onToggle: (id: string) => void;
        children: Snippet;
    }

    let { id, ticks, onToggle, children }: Props = $props();

    let checked = $derived(ticks[id] === true);
</script>

<label class="item" class:checked>
    <input type="checkbox" {checked} onchange={() => onToggle(id)} />
    <div class="text">
        {@render children()}
    </div>
</label>

<style lang="scss">
    .item {
        display: flex;
        align-items: flex-start;
        gap: toRem(12);
        padding: toRem(10) toRem(12);
        border-radius: toRem(8);
        cursor: pointer;

        &:hover {
            background-color: rgba(255, 255, 255, 0.05);
        }

        input {
            flex: 0 0 auto;
            width: toRem(18);
            height: toRem(18);
            margin-top: toRem(3);
            accent-color: var(--landing-txt);
            cursor: pointer;
        }

        .text {
            flex: 1;
        }

        &.checked .text {
            opacity: 0.6;
        }
    }
</style>
