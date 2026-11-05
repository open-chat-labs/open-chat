<script lang="ts">
    import {
        BodySmall,
        Button,
        Column,
        Option,
        Row,
        Select,
        Sheet,
        Subtitle,
        Switch,
    } from "component-lib";
    import {
        iconSize,
        isCsamReport,
        REPORT_REASONS,
        reportReasonText,
        type ChatIdentifier,
        type OpenChat,
        type ReportReason,
    } from "@client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Flag from "svelte-material-icons/Flag.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { toastStore } from "../../stores/toast";
    import Setting from "../Setting.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import Markdown from "@src/core/Markdown.svelte";

    interface Props {
        chatId: ChatIdentifier;
        messageId: bigint;
        threadRootMessageIndex: number | undefined;
        canDelete: boolean;
        onClose: () => void;
    }

    let { chatId, messageId, threadRootMessageIndex, canDelete, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");

    let deleteMessage = $state(false);
    const busy = $state(false);
    let selectedReason = $state<ReportReason>();

    // "child sexual content": the report is treated like a classifier detection and the
    // auto-sanction applies immediately, so it gets an explicit warning
    let csam = $derived(isCsamReport(selectedReason));
    let valid = $derived(selectedReason !== undefined);

    function createReport() {
        if (selectedReason !== undefined) report(selectedReason);
        onClose();
    }

    function report(reason: ReportReason) {
        client
            .reportMessage(
                chatId,
                threadRootMessageIndex,
                messageId,
                canDelete && deleteMessage,
                reason,
            )
            .then((success) => {
                if (success) {
                    toastStore.showSuccessToast(i18nKey("report.success"));
                } else {
                    toastStore.showFailureToast(i18nKey("report.failure"));
                }
            });
    }
</script>

<Sheet>
    <Column gap={"xl"} padding={"xl"}>
        <Row crossAxisAlignment={"center"} gap={"sm"}>
            <Flag size={$iconSize} color={"var(--validation-error)"} />
            <Subtitle fontWeight={"bold"}
                ><Translatable resourceKey={i18nKey("report.title")} /></Subtitle
            >
        </Row>
        <Column gap={"lg"}>
            <Select
                error={selectedReason === undefined}
                placeholder={"Select a reason for your report"}
                onSelect={(reason) => (selectedReason = reason)}
                value={selectedReason}
            >
                {#snippet subtext()}
                    <Translatable resourceKey={i18nKey("Select a reason for your report")} />
                {/snippet}
                {#snippet selectedValue(reason)}
                    <Translatable resourceKey={reportReasonText(reason)} />
                {/snippet}
                {#snippet selectOptions(onSelect)}
                    <Column
                        onClick={(e) => e?.stopPropagation()}
                        height={{ size: "100%" }}
                        supplementalClass={"reason_options"}
                        padding={"lg"}
                        gap={"lg"}
                    >
                        {#each REPORT_REASONS as reason}
                            <Option
                                padding={"xs"}
                                selected={false}
                                value={reason}
                                onClick={onSelect}
                            >
                                <Translatable resourceKey={reportReasonText(reason)} />
                            </Option>
                        {/each}
                    </Column>
                {/snippet}
            </Select>
            {#if csam}
                <BodySmall colour={"validationError"}>
                    <Translatable resourceKey={i18nKey("report.csamWarning")} />
                </BodySmall>
            {/if}
            {#if canDelete}
                <Setting
                    toggle={() => (deleteMessage = !deleteMessage)}
                    info={"As well as reporting this message, you can also choose whether or not to delete it by toggling this setting."}
                >
                    <Switch
                        onChange={() => (deleteMessage = !deleteMessage)}
                        width={"fill"}
                        reverse
                        checked={deleteMessage}
                    >
                        <Translatable resourceKey={i18nKey("Delete message")} />
                    </Switch>
                </Setting>
            {/if}

            <BodySmall colour={"textSecondary"}>
                <Markdown
                    text={$_("report.advice", {
                        values: { rules: "https://oc.app/guidelines?section=3" },
                    })}
                />
            </BodySmall>
        </Column>
        <Column gap={"md"}>
            <Button disabled={!valid} loading={busy} onClick={createReport}
                ><Translatable resourceKey={i18nKey("report.menu")} /></Button
            >
            <Button secondary onClick={onClose}
                ><Translatable resourceKey={i18nKey("cancel")} /></Button
            >
        </Column>
    </Column>
</Sheet>
