<script lang="ts">
    import { currentUserStore } from "@client";
    import { i18nKey } from "@src/i18n/i18n";
    import Markdown from "@src/ui/Markdown.svelte";
    import ModalContent from "@src/ui/ModalContent.svelte";
    import Translatable from "@src/ui/Translatable.svelte";

    interface Props {
        onClose: () => void;
    }

    let { onClose }: Props = $props();

    function buildNoticeText(): string {
        const suspensionDetails = $currentUserStore.suspensionDetails!;
        const actionDate = new Date(Number(suspensionDetails.action.timestamp));
        const actionText =
            suspensionDetails.action.kind === "delete_action" ? "deleted" : "unsuspended";

        return `Your account has been suspended.

Reason:
"${suspensionDetails.reason}"

You can appeal this suspension by sending a direct message to the @OpenChat Twitter account otherwise your account will be ${actionText} on ${actionDate.toLocaleString()}.`;
    }
</script>

<ModalContent {onClose}>
    {#snippet header()}
        <Translatable resourceKey={i18nKey("accountSuspended")} />
    {/snippet}
    {#snippet body()}
        <Markdown text={buildNoticeText()} />
    {/snippet}
</ModalContent>
