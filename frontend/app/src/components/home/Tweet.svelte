<svelte:options immutable />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import { themeStore } from "../../theme/themes";
    import { createEventDispatcher, onMount } from "svelte";
    import { eventListScrolling } from "../../stores/scrollPos";

    const dispatch = createEventDispatcher();

    export let intersecting: boolean;
    export let tweetId: string;

    let tweetWrapper: HTMLDivElement | undefined;
    let tweetRendered = false;
    let supported = false;

    onMount(() => {
        supported = (<any>window).twttr !== undefined;
    });

    $: {
        if (
            intersecting &&
            !$eventListScrolling &&
            tweetWrapper !== undefined &&
            !tweetRendered &&
            supported
        ) {
            tweetWrapper.innerHTML = "";
            (<any>window).twttr?.widgets
                .createTweet(tweetId, tweetWrapper, {
                    conversation: "none",
                    theme: $themeStore.name,
                })
                .then(() => {
                    tweetRendered = true;
                    dispatch("rendered", tweetWrapper);
                })
                .catch((err: any) => {
                    console.log("Failed to render tweet: ", err);
                });
        }
    }
</script>

<div bind:this={tweetWrapper} />
