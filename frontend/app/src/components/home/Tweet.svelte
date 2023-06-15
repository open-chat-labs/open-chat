<svelte:options immutable={true} />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import { themeStore } from "../../theme/themes";
    import { onMount } from "svelte";

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
                .then(() => (tweetRendered = true))
                .catch((err: any) => {
                    console.log("Failed to render tweet: ", err);
                });
        }
    }
</script>

<div class:rendered={tweetRendered} class="tweet" bind:this={tweetWrapper} />

{#if !tweetRendered && supported}
    <div class="preview">
        <div class="logo" />
        <p class="label">
            {$_("loadingTweetPreview")}
        </p>
    </div>
{/if}

<style lang="scss">
    .preview {
        display: flex;
        flex-direction: column;
        justify-content: space-evenly;
        align-items: center;
        min-height: toRem(150);

        .logo {
            @include loading-spinner(4em, 2em, var(--button-spinner), "../assets/twitter.svg");
            &::after {
                @include pulse();
            }
        }

        .label {
            text-align: center;
            opacity: 0.9;
        }
    }
</style>
