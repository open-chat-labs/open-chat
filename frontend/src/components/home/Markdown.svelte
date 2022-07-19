<svelte:options immutable={true} />

<script lang="ts">
    import { userStore } from "../../stores/user";
    import { _ } from "svelte-i18n";
    import MarkdownLink from "./MarkdownLink.svelte";
    import FakeMarkdownLink from "./FakeMarkdownLink.svelte";
    import SvelteMarkdown from "svelte-markdown";

    export let text: string;
    export let inline: boolean = true;
    export let oneLine: boolean = false;
    export let suppressLinks: boolean = false;

    $: parsed = replaceUserIds(text);

    function replaceUserIds(text: string): string {
        return text.replace(/@UserId\(([\d\w-]+)\)/g, (match, p1) => {
            const u = $userStore[p1];
            if (u !== undefined) {
                return `**[@${u.username}](#/${u.userId}?type=direct)**`;
            }
            return match;
        });
    }
</script>

<p class="markdown-wrapper" class:inline class:oneLine>
    {#if suppressLinks}
        <SvelteMarkdown
            renderers={{
                link: FakeMarkdownLink,
            }}
            isInline={true}
            source={parsed}
            options={{
                breaks: !oneLine,
            }} />
    {:else}
        <SvelteMarkdown
            renderers={{
                link: MarkdownLink,
            }}
            isInline={true}
            source={parsed}
            options={{
                breaks: !oneLine,
            }} />
    {/if}
</p>

<style type="text/scss">
    :global(.markdown-wrapper a) {
        text-decoration: underline;
    }

    :global(.markdown-wrapper code) {
        border: 1px solid rgba(0, 0, 0, 0.1);
        background-color: rgba(255, 255, 255, 0.1);
        padding: 0 $sp2;
    }

    .markdown-wrapper {
        word-wrap: break-word;
    }

    .markdown-wrapper:not(:empty) {
        display: inline;

        &:not(.inline) {
            display: block;
        }

        &.oneLine {
            display: block;
            @include ellipsis();
        }
    }
</style>
