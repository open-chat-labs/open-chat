<script lang="ts">
    import { pop } from "../../../utils/transition";

    export let label: string;
    export let selected: boolean = false;
    export let separator: boolean = false;
    export let unread = 0;
</script>

<div role="button" tabindex="0" class:separator class:selected class="left-nav-item" on:click>
    <div class="icon">
        <slot />
        {#if unread > 0}
            <div in:pop={{ duration: 1500 }} class="unread">
                {unread > 999 ? "999+" : unread}
            </div>
        {/if}
    </div>
    <div class="label">{label}</div>
    <div class="menu"><slot name="menu" /></div>
</div>

<style lang="scss">
    .left-nav-item {
        display: flex;
        align-items: center;
        gap: $sp4;
        padding: $sp3 $sp4;
        cursor: pointer;

        @include mobile() {
            padding: 6px 10px;
        }

        &:hover {
            background-color: var(--chatSummary-hv);
        }

        &.selected {
            background-color: var(--chatSummary-bg-selected);
        }

        &.separator {
            border-bottom: 1px solid var(--bd);
        }

        .icon {
            flex: 0 0 toRem(48);
            width: toRem(48);
            height: toRem(48);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;

            @include mobile() {
                flex: 0 0 toRem(35);
                width: toRem(35);
                height: toRem(35);
            }

            .unread {
                @include unread();
                right: toRem(-9);
                bottom: 0;
                position: absolute;
            }
        }

        .label {
            flex: auto;
            white-space: nowrap;
        }

        .menu {
            flex: 0 0 toRem(30);
        }
    }
</style>
