<script lang="ts">
    import ModalContent from "./ModalContent.svelte";
    import CollapsibleCard from "./CollapsibleCard.svelte";
    import ContentCopy from "svelte-material-icons/ContentCopy.svelte";
    import { allQuestions, Questions } from "openchat-client";
    import { _ } from "svelte-i18n";
    import Markdown from "./home/Markdown.svelte";
    import { toastStore } from "../stores/toast";

    export let question: Questions | undefined = undefined;
    export let fadeDuration = 100;
    export let fadeDelay = 200;

    function copyUrl(question: Questions): void {
        const url = `${window.location.origin}?faq=${question}`;
        navigator.clipboard.writeText(url).then(
            () => {
                toastStore.showSuccessToast("faqUrlCopiedToClipboard");
            },
            () => {
                toastStore.showFailureToast("failedToCopyUrlToClipboard", {
                    values: { url },
                });
            }
        );
    }
</script>

<ModalContent fill {fadeDuration} {fadeDelay} large on:close>
    <div slot="header">{$_("faq.header")}</div>
    <div class="faq-body" slot="body">
        {#each allQuestions as q}
            <CollapsibleCard
                open={question === q}
                on:opened={() => (question = q)}
                headerText={$_(`faq.${q}_q`)}>
                <div class="header" slot="titleSlot">
                    <div class="copy" on:click|stopPropagation={() => copyUrl(q)}>
                        <ContentCopy size={"1em"} />
                    </div>
                    <h4>{$_(`faq.${q}_q`)}</h4>
                </div>
                <Markdown text={$_(`faq.${q}_a`)} />
            </CollapsibleCard>
        {/each}
    </div>
</ModalContent>

<style type="text/scss">
    .header {
        display: flex;
        align-items: center;
        gap: $sp3;
    }

    .copy {
        height: 18px;
        cursor: pointer;
    }

    .faq-body {
        padding: $sp3 $sp5 0 $sp5;
        @include mobile() {
            padding: $sp3 $sp4 0 $sp4;
        }
    }
</style>
