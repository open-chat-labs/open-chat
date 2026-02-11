<script lang="ts">
    import { BodySmall, Button, Column, Sheet, TextArea, Title } from "component-lib";
    import { ONE_DAY, type ChatIdentifier, type OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Alarm from "svelte-material-icons/Alarm.svelte";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import { now } from "../../stores/time";
    import { toastStore } from "../../stores/toast";
    import Translatable from "../Translatable.svelte";
    import DurationSelector from "./DurationSelector.svelte";

    interface Props {
        chatId: ChatIdentifier;
        eventIndex: number;
        threadRootMessageIndex: number | undefined;
        onClose: () => void;
    }

    let { chatId, eventIndex, threadRootMessageIndex, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");

    let busy = $state(false);
    let note: string = $state("");

    function createReminder() {
        busy = true;
        client
            .setMessageReminder(chatId, eventIndex, remindAtMs, note, threadRootMessageIndex)
            .then((success) => {
                if (success) {
                    toastStore.showSuccessToast(i18nKey("reminders.success"));
                } else {
                    toastStore.showFailureToast(i18nKey("reminders.failure"));
                }
            })
            .finally(() => (busy = false));
        onClose();
    }
    let duration = $state(BigInt(ONE_DAY));
    let remindAtMs = $derived($now + Number(duration));
    let remindAtDate = $derived(new Date(remindAtMs));
</script>

<Sheet onDismiss={onClose}>
    <Column gap={"xl"} padding={"xl"}>
        <Title fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("reminders.title")} />
        </Title>
        <DurationSelector bind:duration></DurationSelector>
        <TextArea
            maxlength={1000}
            rows={4}
            placeholder={interpolate($_, i18nKey("reminders.notePlaceholder"))}
            bind:value={note}>
            {#snippet subtext()}
                <Translatable resourceKey={i18nKey("Optionally add a note to your reminder")} />
            {/snippet}
        </TextArea>
        <Column gap={"md"}>
            <Button disabled={busy} loading={busy} onClick={createReminder}>
                {#snippet icon(color)}
                    <Alarm {color} />
                {/snippet}

                <Translatable resourceKey={i18nKey("reminders.create")} /></Button>
            <BodySmall align={"center"} colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey("reminders.remindAt", {
                        datetime: client.toDatetimeString(remindAtDate),
                    })} />
            </BodySmall>
        </Column>
    </Column>
</Sheet>
