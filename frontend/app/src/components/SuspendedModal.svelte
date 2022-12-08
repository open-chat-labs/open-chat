<script lang="ts">
    import { getContext } from "svelte";
    import ModalContent from "./ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import type { OpenChat } from "openchat-client";
    import Markdown from "./home/Markdown.svelte";

    const client = getContext<OpenChat>("client");

    function buildNoticeText(): string {
        const suspensionDetails = client.user.suspensionDetails!;
        const actionDate = new Date(Number(suspensionDetails.action.timestamp));
        const actionText = suspensionDetails.action.kind === "delete_action"
            ? "deleted"
            : "unsuspended";

        return `Your account has been suspended.

Reason:
"${suspensionDetails.reason}"

You can appeal this suspension by sending a direct message to the @OpenChat Twitter account otherwise your account will be ${actionText} on ${actionDate.toLocaleString()}.`;
    }
</script>

<ModalContent on:close>
    <div slot="header">{$_("accountSuspended")}</div>
    <div slot="body">
        <Markdown text={buildNoticeText()} />
    </div>
</ModalContent>
