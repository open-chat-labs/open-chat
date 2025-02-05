<svelte:options immutable />

<script lang="ts">
    import { currentTheme } from "../../theme/themes";
    import { createEventDispatcher, onMount } from "svelte";
    import { eventListScrolling } from "../../stores/scrollPos";

    const dispatch = createEventDispatcher();

    export let intersecting: boolean;
    export let tweetId: string;

    let tweetWrapper: HTMLDivElement | undefined;
    let supported = false;

    let rendering: Promise<any> | undefined = undefined;

    onMount(() => {
        supported = (window as any).twttr !== undefined;
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

            rendering = (window as any).twttr?.widgets.createTweet(tweetId, tweetWrapper, {
                conversation: "none",
                theme: $currentTheme.mode,
            }) as Promise<any>;

            rendering
                .then(() => {
                    dispatch("rendered", tweetWrapper);
                })
                .catch((err: any) => {
                    console.log("Failed to render tweet: ", err);
                    rendering = undefined;
                });
        }
    }
</script>

<div bind:this={tweetWrapper}></div>
