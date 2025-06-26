<script lang="ts">
    interface Props {
        square?: boolean;
    }

    let { square = false }: Props = $props();
</script>

<div class="icon center" class:square>
    <slot />
</div>

<style lang="scss">
    $height: 45px;

    .center {
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .icon {
        flex: 0 0 60px;
        width: 60px;
        height: $height;
        border-radius: $sp2 0 0 $sp2;
        border-right: 1px solid var(--bd);
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: var(--input-bg);

        &.square {
            border-radius: $sp2;
            border: none;
        }
    }
</style>
