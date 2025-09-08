<script lang="ts">
    import CountBadge from "../CountBadge.svelte";
    import Avatar from "./Avatar.svelte";

    interface Props {
        urls: string[];
    }

    let { urls }: Props = $props();

    // TODO - we need to know what this does when we have exactly two avatars

    let plus = $derived(urls.length - 2);
    let [first, second] = $derived(urls);
</script>

<div class="multi_avatars">
    <div class="first">
        <Avatar url={first} size={"sm"} />
    </div>
    <div class="second">
        <Avatar url={second} size={"sm"} />
    </div>
    <div class="count">
        <CountBadge size={"large"} mode={"additive"}>+{plus}</CountBadge>
    </div>
</div>

<style lang="scss">
    :global(.multi_avatars .second img) {
        border: var(--bw-thick) solid var(--background-2);
    }

    :global(.multi_avatars .badge.additive-mode) {
        border: var(--bw-thick) solid var(--background-1);
    }

    .multi_avatars {
        position: relative;
        width: 3rem;
        height: 3rem;

        .first,
        .second,
        .count {
            position: absolute;
        }

        .first,
        .second {
            width: 2rem;
            height: 2rem;
        }

        .count {
            bottom: 0;
            right: 0;
        }

        .second {
            left: 50%;
            transform: translateX(-50%);
            box-shadow: -2px 2px 2px 0px rgba(0, 0, 0, 0.3);
        }

        .first {
            bottom: 0;
            left: 0;
        }
    }
</style>
