<script lang="ts">
    import type { MessageReminderContent } from "openchat-client";
    import { _ } from "svelte-i18n";
    import ReminderNotes from "./ReminderNotes.svelte";

    export let content: MessageReminderContent;
</script>

<div class="msg">
    ⏰ {$_("reminders.youAsked")}
</div>
<ReminderNotes notes={content.notes} />
