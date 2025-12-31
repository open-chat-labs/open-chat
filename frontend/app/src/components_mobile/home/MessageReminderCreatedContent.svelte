<script lang="ts">
    import { ChatText, ColourVars, Column, Row } from "component-lib";
    import type { MessageReminderCreatedContent, OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import Alarm from "svelte-material-icons/Alarm.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import ReminderNotes from "./ReminderNotes.svelte";

    interface Props {
        content: MessageReminderCreatedContent;
    }

    let { content }: Props = $props();
    const client = getContext<OpenChat>("client");
</script>

<Column gap={"lg"}>
    <Row crossAxisAlignment={"center"} gap={"xs"} wrap>
        <ChatText width={"hug"}>
            <Translatable resourceKey={i18nKey("reminders.remindAt", { datetime: "" })} />
        </ChatText>
        <ChatText width={"hug"} fontWeight={"bold"} colour={"primary"}>
            {client.toDatetimeString(new Date(content.remindAt))}
        </ChatText>
        <Alarm color={ColourVars.textPrimary} />
    </Row>
    <ReminderNotes notes={content.notes} />
</Column>
