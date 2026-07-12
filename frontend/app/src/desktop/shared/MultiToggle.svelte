<script module lang="ts">
    export type Option = {
        id: string;
        label: string;
    };
</script>

<script lang="ts">
    interface Props {
        options: Option[];
        selected: string;
    }

    let { options, selected = $bindable() }: Props = $props();

    function selectOption(id: string) {
        selected = id;
    }
</script>

<div class="toggle-wrapper" role="radiogroup">
    {#each options as { id, label }, i}
        <div
            role="radio"
            tabindex={i}
            class="toggle"
            class:selected={id === selected}
            class:first={i === 0}
            class:last={i === options.length - 1}
            onclick={() => selectOption(id)}>
            {label}
        </div>
    {/each}
</div>

<style lang="scss">
    .toggle-wrapper {
        display: flex;
        align-items: center;
        border: var(--bw) solid var(--bd);
        border-radius: var(--rd);
        cursor: pointer;

        .toggle {
            border: none;
            border-right: 1px solid var(--bd);
            padding: 6px 10px 5px 10px;
            white-space: nowrap;

            &.selected {
                color: var(--button-txt);
                background: var(--button-bg);
            }

            &:hover {
                color: var(--button-hv-txt);
                background: var(--button-hv);
            }

            &.first {
                border-radius: var(--rd) 0 0 var(--rd);
            }

            &.last {
                border-right: none;
                border-radius: 0 var(--rd) var(--rd) 0;
            }
        }
    }
</style>
