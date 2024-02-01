<script lang="ts">
    import type { MessageReminderCreatedContent, OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import ReminderNotes from "./ReminderNotes.svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";

    export let content: MessageReminderCreatedContent;
    const client = getContext<OpenChat>("client");
</script>

<div class="msg">
    ⏰ <Translatable resourceKey={i18nKey("reminders.remindAt", { datetime: "" })} />
    <span class="datetime">{client.toDatetimeString(new Date(content.remindAt))}</span>
</div>
<ReminderNotes notes={content.notes} />

<style lang="scss">
    .datetime {
        font-weight: 700;
    }
</style>
