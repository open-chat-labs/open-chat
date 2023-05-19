<script lang="ts">
    export let label: string;
    export let selected: boolean = false;
    export let separator: boolean = false;
</script>

<div class:separator class:selected class="left-nav-item" on:click>
    <div class="icon"><slot /></div>
    <div class="label">{label}</div>
    <div class="menu"><slot name="menu" /></div>
</div>

<style type="text/scss">
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

            @include mobile() {
                flex: 0 0 toRem(35);
                width: toRem(35);
                height: toRem(35);
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
