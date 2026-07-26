<script lang="ts">
    import { Body, Button, ColourVars, Column, H2, Row, Sheet } from "component-lib";
    import { currentUserStore, type OpenChat } from "@client";
    import { getContext } from "svelte";
    import RobotDead from "svelte-material-icons/RobotDeadOutline.svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../i18n/i18n";
    import Translatable from "./Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        onClose: () => void;
    }

    let { onClose }: Props = $props();

    let contesting = $state(false);
    let contestOutcome: "requested" | "failed" | undefined = $state(undefined);

    // The GDPR Art 22 safeguard: sanctions applied by automated moderation can be contested,
    // which queues the decision for priority human review
    function contest() {
        if (contesting || contestOutcome === "requested") return;
        contesting = true;
        client.contestModerationSanction().then((success) => {
            contesting = false;
            contestOutcome = success ? "requested" : "failed";
        });
    }

    let suspensionDetails = $derived($currentUserStore.suspensionDetails);
    let actionDate = $derived(new Date(Number(suspensionDetails?.action?.timestamp)));
    let notice = $derived(
        $_(
            suspensionDetails?.action?.kind === "delete_action"
                ? "suspendedNotice.appealDeleted"
                : "suspendedNotice.appealUnsuspended",
            { values: { email: "safety@openchatlabs.org", date: actionDate?.toLocaleString() } },
        ),
    );
</script>

<Sheet onDismiss={onClose}>
    <Column crossAxisAlignment={"center"} gap={"xl"} padding={"xl"}>
        <H2 width={"hug"} fontWeight={"bold"} colour={"primary"}>
            <Translatable resourceKey={i18nKey("accountSuspended")} />
        </H2>
        <Row padding={["lg", "zero"]} mainAxisAlignment={"center"}>
            <RobotDead color={ColourVars.primary} size={"6rem"} />
        </Row>
        <Column>
            {#if $currentUserStore.suspensionDetails?.reason !== undefined}
                <Row gap={"sm"}>
                    <Body width={"hug"} colour={"primary"}>
                        <Translatable resourceKey={i18nKey("suspendedNotice.reason")} />
                    </Body>
                    <Body width={"hug"}>{$currentUserStore.suspensionDetails?.reason}</Body>
                </Row>
            {/if}
        </Column>
        <Body colour={"textSecondary"}>{notice}</Body>
        <Body colour={"textSecondary"}>
            <Translatable resourceKey={i18nKey("suspendedContest.info")} />
        </Body>
        <Button loading={contesting} disabled={contesting} onClick={contest}>
            <Translatable resourceKey={i18nKey("suspendedContest.button")} />
        </Button>
        {#if contestOutcome === "requested"}
            <Body><Translatable resourceKey={i18nKey("suspendedContest.requested")} /></Body>
        {:else if contestOutcome === "failed"}
            <Body><Translatable resourceKey={i18nKey("suspendedContest.failed")} /></Body>
        {/if}
    </Column>
</Sheet>
