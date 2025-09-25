<script lang="ts">
    import type { Snippet } from "svelte";
    import Arrow from "./Arrow.svelte";

    interface Props {
        url: string;
        color?: string;
        target?: string | undefined;
        children?: Snippet;
    }

    let { url, color = "#7E52FF", target = undefined, children }: Props = $props();
</script>

<a class="link" href={url} {target}>
    {@render children?.()}
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

        @media (hover: hover) {
            &:hover {
                text-decoration: none;
                color: var(--landing-txt-light);

                .arrow {
                    flex: 0 0 toRem(24);
                }
            }
        }
    }
</style>
