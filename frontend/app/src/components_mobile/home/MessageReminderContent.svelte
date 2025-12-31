<script lang="ts">
    import { ChatText, Column } from "component-lib";
    import type { MessageReminderContent } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import ReminderNotes from "./ReminderNotes.svelte";

    interface Props {
        content: MessageReminderContent;
    }

    let { content }: Props = $props();
</script>

<Column gap={"lg"}>
    <ChatText width={"hug"}>
        <Translatable resourceKey={i18nKey("reminders.youAsked")} />
    </ChatText>
    <ReminderNotes notes={content.notes} />
</Column>
