<script lang="ts">
    import { onMount } from "svelte";
    import { currentTheme } from "../../theme/themes";

    interface Props {
        tweetId: string;
    }

    let { tweetId }: Props = $props();

    let tweetWrapper: HTMLDivElement | undefined = $state();
    let supported = $state(false);

    let rendering: Promise<any> | undefined = $state(undefined);

    onMount(() => {
        supported = (<any>window).twttr !== undefined;
    });

    $effect(() => {
        if (
            tweetWrapper !== undefined &&
            !rendering &&
            supported
        ) {
            tweetWrapper.innerHTML = "";

            rendering = (<any>window).twttr?.widgets.createTweet(tweetId, tweetWrapper, {
                conversation: "none",
                theme: $currentTheme.mode,
            }) as Promise<any>;

            rendering.catch((err: any) => {
                console.log("Failed to render tweet: ", err);
                rendering = undefined;
            });
        }
    });
</script>

<div bind:this={tweetWrapper}></div>
