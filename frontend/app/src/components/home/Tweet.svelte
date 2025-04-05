<script lang="ts">
    import { currentTheme } from "../../theme/themes";
    import { onMount } from "svelte";
    import { eventListScrolling } from "../../stores/scrollPos";

    interface Props {
        intersecting: boolean;
        tweetId: string;
        onRendered: (el: HTMLDivElement) => void;
    }

    let { intersecting, tweetId, onRendered }: Props = $props();

    let tweetWrapper: HTMLDivElement | undefined = $state();
    let supported = $state(false);

    let rendering: Promise<any> | undefined = $state(undefined);

    onMount(() => {
        supported = (<any>window).twttr !== undefined;
    });

    $effect(() => {
        if (
            intersecting &&
            !$eventListScrolling &&
            tweetWrapper !== undefined &&
            !rendering &&
            supported
        ) {
            tweetWrapper.innerHTML = "";

            rendering = (<any>window).twttr?.widgets.createTweet(tweetId, tweetWrapper, {
                conversation: "none",
                theme: $currentTheme.mode,
            }) as Promise<any>;

            rendering
                .then(() => {
                    onRendered(tweetWrapper!);
                })
                .catch((err: any) => {
                    console.log("Failed to render tweet: ", err);
                    rendering = undefined;
                });
        }
    });
</script>

<div bind:this={tweetWrapper}></div>
