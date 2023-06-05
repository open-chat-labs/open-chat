<script lang="ts">
    import { allQuestions, Questions } from "openchat-client";
    import CollapsibleCard from "../CollapsibleCard.svelte";
    import Markdown from "../home/Markdown.svelte";
    import ContentCopy from "svelte-material-icons/ContentCopy.svelte";
    import Headline from "./Headline.svelte";
    import { querystring, location } from "../../routes";
    import { copyToClipboard } from "../../utils/urls";
    import { _ } from "svelte-i18n";
    import { mobileWidth } from "../../stores/screenDimensions";

    let question: Questions | undefined = undefined;

    $: {
        const q = $querystring.get("q");
        if (q) {
            question = q as Questions;
        }
    }

    $: copySize = $mobileWidth ? "14px" : "16px";

    function copyUrl(q: string): void {
        copyToClipboard(`${window.location.origin}${$location}?q=${q}`);
    }
</script>

<div class="faq">
    <Headline>OpenChat FAQs</Headline>

    {#each allQuestions as q, i}
        <CollapsibleCard
            open={question === q}
            transition={false}
            on:opened={() => (question = q)}
            headerText={$_(`faq.${q}_q`)}>
            <div class="header" slot="titleSlot">
                <div class="title">
                    {$_(`faq.${q}_q`)}
                    <div class="copy" on:click|stopPropagation={() => copyUrl(q)}>
                        <ContentCopy size={copySize} color={"var(--landing-txt)"} />
                    </div>
                </div>
            </div>
            <div class="body">
                <Markdown text={$_(`faq.${q}_a`)} />
            </div>
        </CollapsibleCard>
    {/each}
</div>

<style lang="scss">
    .faq {
        text-align: left;
        @include lp-content-padding();
        margin-top: toRem(80);

        @include mobile() {
            margin-top: 0;
        }
    }
    .body {
        padding: 0 0 toRem(30) 0;
        max-width: 75%;
        color: var(--landing-txt);

        @include mobile() {
            padding: 0 0 toRem(24) 0;
            max-width: 100%;
        }
    }

    .body p,
    .body li {
        @include font(book, normal, fs-100, 28);
    }

    .body p {
        margin-bottom: toRem(24);
    }

    .header {
        display: flex;
        align-items: center;
        flex: auto;
        color: var(--landing-txt);
        @include font(medium, normal, fs-160, 38);
        @include mobile() {
            @include font(medium, normal, fs-110, 24);
        }

        .title {
            flex: auto;
            display: flex;
            align-items: center;
            gap: $sp3;

            .copy {
                cursor: pointer;

                opacity: 0;
                transition: opacity 250ms ease-in-out;
            }

            &:hover .copy {
                opacity: 1;
            }
        }
    }
</style>
