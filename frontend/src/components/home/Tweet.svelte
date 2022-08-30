<svelte:options immutable={true} />

<script lang="ts">
    import { _ } from "svelte-i18n";
    import { themeStore } from "../../theme/themes";

    export let text: string;
    export let intersecting: boolean;
    export let tweetId: string;

    let tweetWrapper: HTMLDivElement | undefined;
    let tweetRendered = false;

    $: {
        if (intersecting && tweetWrapper !== undefined && !tweetRendered) {
            tweetWrapper.innerHTML = "";
            (<any>window).twttr.widgets
                .createTweet(tweetId, tweetWrapper, {
                    conversation: "none",
                    theme: $themeStore.name,
                })
                .then(() => {
                    tweetRendered = true;
                    console.log("Rendered tweet, ", text);
                });
        }
    }
</script>

<div class:rendered={tweetRendered} class="tweet" bind:this={tweetWrapper} />

{#if !tweetRendered}
    <div class="preview">
        <div class="logo" />
        <p class="label">
            {$_("loadingTweetPreview")}
        </p>
    </div>
{/if}

<style type="text/scss">
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
