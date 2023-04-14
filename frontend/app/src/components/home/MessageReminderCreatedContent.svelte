<script lang="ts">
    import type { MessageReminderCreatedContent, OpenChat } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import ReminderNotes from "./ReminderNotes.svelte";

    export let content: MessageReminderCreatedContent;
    const client = getContext<OpenChat>("client");
</script>

<div class="msg">
    ⏰ {$_("reminders.remindAt", { values: { datetime: "" } })}
    <span class="datetime">{client.toDatetimeString(new Date(content.remindAt))}</span>
</div>
<ReminderNotes notes={content.notes} />

<style type="text/scss">
    .datetime {
        font-weight: 700;
    }
</style>
