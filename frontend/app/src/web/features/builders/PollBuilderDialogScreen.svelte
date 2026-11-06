<!-- The composer's "+" → Poll (5d): PollBuilderDialog, published at once as the old builders did
     (sendContent, replying to the draft's reply), its end stamped as it's sent. The dialog waits
     for the poll to show in the chat, and keeps it with an error if it was refused (the rules
     turned down, throttled, a send already on its way). -->
<script lang="ts">
    import { newPollContent, type OpenChat } from "@client";
    import PollBuilderDialog, {
        type PollDraft,
    } from "@openchat/ui/src/features/components/PollBuilderDialog.svelte";
    import { getContext } from "svelte";
    import type { DialogProps, LocalDialog } from "../app/dialogs";
    import { newPoll } from "./builders.adapter";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "poll_builder" }>> = $props();

    const client = getContext<OpenChat>("client");

    async function publish(draft: PollDraft) {
        const outcome = await client.sendContent(
            { chatId: dialog.chatId },
            newPollContent(newPoll(draft), Date.now()),
        );
        if (outcome.kind !== "posted") throw new Error(outcome.kind);
        onClose();
    }
</script>

<PollBuilderDialog onPublish={publish} {onClose} />
