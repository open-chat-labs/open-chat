<script lang="ts">
    import ModalContent from "./ModalContent.svelte";
    import { currentUser as user } from "openchat-client";
    import Markdown from "./home/Markdown.svelte";
    import Translatable from "./Translatable.svelte";
    import { i18nKey } from "../i18n/i18n";

    interface Props {
        onClose: () => void;
    }

    let { onClose }: Props = $props();

    function buildNoticeText(): string {
        const suspensionDetails = $user.suspensionDetails!;
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
