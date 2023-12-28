<svelte:options immutable />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import { currentTheme } from "../../theme/themes";
    import { onMount } from "svelte";
    import { eventListScrolling } from "../../stores/scrollPos";

    export let intersecting: boolean;
    export let tweetId: string;

    let tweetWrapper: HTMLDivElement | undefined;
    let supported = false;
    let rendering = false;

    onMount(() => {
        supported = (<any>window).twttr !== undefined;
    });

    $: {
        if (
            intersecting &&
            !$eventListScrolling &&
            tweetWrapper !== undefined &&
            !rendering &&
            supported
        ) {
            tweetWrapper.innerHTML = "";
            rendering = true;

            (<any>window).twttr?.widgets.createTweet(tweetId, tweetWrapper, {
                conversation: "none",
                theme: $currentTheme.mode,
            });
        }
    }
</script>

<div bind:this={tweetWrapper} />
