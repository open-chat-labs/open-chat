<svelte:options immutable />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import { themeStore } from "../../theme/themes";
    import { createEventDispatcher, onMount } from "svelte";
    import { lowBandwidth } from "../../stores/settings";

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
        if (intersecting && tweetWrapper !== undefined && !tweetRendered && supported) {
            tweetWrapper.innerHTML = "";
            (<any>window).twttr?.widgets
                .createTweet(tweetId, tweetWrapper, {
                    conversation: "none",
                    theme: $themeStore.name,
                })
                .then(() => {
                    tweetRendered = true;
                    if (!$lowBandwidth) {
                        dispatch("loaded", [tweetWrapper, tweetWrapper?.offsetHeight]);
                    }
                })
                .catch((err: any) => {
                    console.log("Failed to render tweet: ", err);
                });
        }
    }
</script>

<div class:rendered={tweetRendered} class="tweet" bind:this={tweetWrapper} />
