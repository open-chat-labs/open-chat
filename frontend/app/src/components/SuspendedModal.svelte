<script lang="ts">
    import { currentUserStore, type OpenChat } from "@client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../i18n/i18n";
    import Markdown from "@shared_components/Markdown.svelte";
    import Button from "./Button.svelte";
    import ModalContent from "./ModalContent.svelte";
    import Translatable from "./Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        onClose: () => void;
    }

    let { onClose }: Props = $props();

    let contesting = $state(false);
    let contestOutcome: "requested" | "failed" | undefined = $state(undefined);

    // The GDPR Art 22 safeguard: sanctions applied by automated moderation can be contested,
    // which queues the decision for priority human review
    function contest() {
        if (contesting || contestOutcome === "requested") return;
        contesting = true;
        client.contestModerationSanction().then((success) => {
            contesting = false;
            contestOutcome = success ? "requested" : "failed";
        });
    }

    function buildNoticeText(): string {
        const suspensionDetails = $currentUserStore.suspensionDetails!;
        const actionDate = new Date(Number(suspensionDetails.action.timestamp));
        const appealKey =
            suspensionDetails.action.kind === "delete_action"
                ? "suspendedNotice.appealDeleted"
                : "suspendedNotice.appealUnsuspended";
        const appeal = $_(appealKey, {
            values: { email: "safety@openchatlabs.org", date: actionDate.toLocaleString() },
        });

        return `${$_("suspendedNotice.intro")}

${$_("suspendedNotice.reason")}
"${suspensionDetails.reason}"

${appeal}`;
    }
</script>

<ModalContent {onClose}>
    {#snippet header()}
        <Translatable resourceKey={i18nKey("accountSuspended")} />
    {/snippet}
    {#snippet body()}
        <Markdown text={buildNoticeText()} />
        <div class="contest">
            <Translatable resourceKey={i18nKey("suspendedContest.info")} />
            <Button loading={contesting} disabled={contesting} onClick={contest}>
                <Translatable resourceKey={i18nKey("suspendedContest.button")} />
            </Button>
            {#if contestOutcome === "requested"}
                <Translatable resourceKey={i18nKey("suspendedContest.requested")} />
            {:else if contestOutcome === "failed"}
                <Translatable resourceKey={i18nKey("suspendedContest.failed")} />
            {/if}
        </div>
    {/snippet}
</ModalContent>

<style lang="scss">
    .contest {
        display: flex;
        flex-direction: column;
        gap: $sp3;
        margin-top: $sp4;
    }
</style>
