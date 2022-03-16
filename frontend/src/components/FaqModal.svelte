<script lang="ts">
    import ModalContent from "./ModalContent.svelte";
    import CollapsibleCard from "./CollapsibleCard.svelte";
    import type { Questions } from "../domain/faq";
    import { _ } from "svelte-i18n";
    import Markdown from "./home/Markdown.svelte";

    export let question: Questions | undefined = undefined;
    export let fadeDuration = 100;
    export let fadeDelay = 200;

    let questions: Questions[] = [
        "ios_app",
        "android_app",
        "find_groups",
        "style_messages",
        "sms_icp",
        "airdrop",
        "security",
        "icp_account",
        "send_icp",
        "roadmap",
    ];
</script>

<ModalContent {fadeDuration} {fadeDelay} large={true} on:close>
    <div slot="header">{$_("faq.header")}</div>
    <div class="faq-body" slot="body">
        {#each questions as q}
            <CollapsibleCard
                bordered={true}
                open={question === q}
                on:opened={() => (question = q)}
                headerText={$_(`faq.${q}_q`)}>
                <Markdown text={$_(`faq.${q}_a`)} />
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
</style>
