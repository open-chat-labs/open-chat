<script lang="ts">
    import Arrow from "./Arrow.svelte";

    export let url: string;
    export let color: string = "#7E52FF";
    export let target: string | undefined = undefined;
</script>

<a class="link" href={url} {target}>
    <slot />
    <div class="arrow">
        <Arrow {color} />
    </div>
</a>

<style lang="scss">
    a {
        position: relative;
        @include font(bold, normal, fs-100);
        color: inherit;
        text-decoration: none;
        display: flex;
        align-items: center;
        gap: $sp3;
        transition: color 250ms ease-in-out;
        white-space: nowrap;

        .arrow {
            transition: flex 250ms ease-in-out;
            flex: 0 0 toRem(16);
            text-align: end;
        }

        &:hover {
            text-decoration: none;
            color: var(--landing-txt-light);

            .arrow {
                flex: 0 0 toRem(24);
            }
        }
    }
</style>
