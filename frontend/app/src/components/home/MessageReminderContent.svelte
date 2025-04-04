<script lang="ts">
    import type { MessageReminderContent } from "openchat-client";
    import ReminderNotes from "./ReminderNotes.svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";

    interface Props {
        content: MessageReminderContent;
    }

    let { content }: Props = $props();
</script>

<div class="msg">
    ⏰ <Translatable resourceKey={i18nKey("reminders.youAsked")} />
</div>
<ReminderNotes notes={content.notes} />
