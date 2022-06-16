<script lang="ts">
    import ModalContent from "./ModalContent.svelte";
    import CollapsibleCard from "./CollapsibleCard.svelte";
    import ContentCopy from "svelte-material-icons/ContentCopy.svelte";
    import { allQuestions, Questions } from "../domain/faq";
    import { _ } from "svelte-i18n";
    import Markdown from "./home/Markdown.svelte";
    import { toastStore } from "../stores/toast";
    import CellphoneCheck from "./customIcons/CellphoneCheck.svelte";
    import DatabaseCheck from "./customIcons/DatabaseCheck.svelte";
    import Star3Points from "./customIcons/Star3Points.svelte";
    import Star4Points from "./customIcons/Star4Points.svelte";
    import Star5Points from "./customIcons/Star5Points.svelte";
    import Star6Points from "./customIcons/Star6Points.svelte";
    import Star8Points from "./customIcons/Star8Points.svelte";
    import Star10Points from "./customIcons/Star10Points.svelte";
    import { iconSize } from "../stores/iconSize";

    export let question: Questions | undefined = undefined;
    export let fadeDuration = 100;
    export let fadeDelay = 200;

    function copyUrl(question: Questions): void {
        const url = `${window.location.origin}/#/?faq=${question}`;
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

<ModalContent {fadeDuration} {fadeDelay} large on:close>
    <div slot="header">{$_("faq.header")}</div>
    <div class="faq-body" slot="body">
        {#each allQuestions as q}
            <CollapsibleCard
                bordered={true}
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
                {#if q === "badges"}
                    <br /><br />
                    <div class="badges">
                        <div class="badge">
                            <DatabaseCheck size={$iconSize} color={"var(--icon-txt)"} />
                            <span>{$_("faq.badges_a_phone")}</span>
                        </div>
                        <div class="badge">
                            <CellphoneCheck size={$iconSize} color={"var(--icon-txt)"} />
                            <span>{$_("faq.badges_a_storage")}</span>
                        </div>
                        <div class="badge">
                            <Star3Points size={$iconSize} color={"var(--icon-txt)"} />
                            <span>{$_("faq.badges_a_new")}</span>
                        </div>
                        <div class="badge">
                            <Star4Points size={$iconSize} color={"var(--icon-txt)"} />
                            <span>{$_("faq.badges_a_1week")}</span>
                        </div>
                        <div class="badge">
                            <Star5Points size={$iconSize} color={"var(--icon-txt)"} />
                            <span>{$_("faq.badges_a_1month")}</span>
                        </div>
                        <div class="badge">
                            <Star6Points size={$iconSize} color={"var(--icon-txt)"} />
                            <span>{$_("faq.badges_a_3month")}</span>
                        </div>
                        <div class="badge">
                            <Star8Points size={$iconSize} color={"var(--icon-txt)"} />
                            <span>{$_("faq.badges_a_6month")}</span>
                        </div>
                        <div class="badge">
                            <Star10Points size={$iconSize} color={"var(--icon-txt)"} />
                            <span>{$_("faq.badges_a_1year")}</span>
                        </div>
                    </div>
                {/if}
            </CollapsibleCard>
        {/each}
    </div>
</ModalContent>

<style type="text/scss">
    :global(.faq-body .card) {
        margin-bottom: $sp3;

        &:last-child {
            margin-bottom: 0;
        }
    }

    .header {
        display: flex;
        align-items: center;
        gap: $sp3;
        @include font(mediumBold, normal, fs-100);
    }

    .copy {
        height: 18px;
        cursor: pointer;
    }

    .badges {
        display: flex;
        flex-direction: column;
        margin: $sp2 0;
        gap: $sp2;
    }

    .badge {
        display: flex;
        align-items: center;
        gap: $sp4;
        span {
            margin-top: 3px;
        }
    }
</style>
