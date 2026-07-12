<script lang="ts">
    import type { MessageReminderContent } from "@client";
    import ReminderNotes from "@src/desktop/features/chats/core/ReminderNotes.svelte";
    import Translatable from "@src/ui/Translatable.svelte";
    import { i18nKey } from "@src/i18n/i18n";

    interface Props {
        content: MessageReminderContent;
    }

    let { content }: Props = $props();
</script>

<div class="msg">
    ⏰ <Translatable resourceKey={i18nKey("reminders.youAsked")} />
</div>
<ReminderNotes notes={content.notes} />
