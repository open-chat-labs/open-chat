<script lang="ts">
    import { Body, ColourVars, Column, H2, Row, Sheet } from "component-lib";
    import { currentUserStore } from "openchat-client";
    import RobotDead from "svelte-material-icons/RobotDeadOutline.svelte";
    import { i18nKey } from "../i18n/i18n";
    import Translatable from "./Translatable.svelte";

    interface Props {
        onClose: () => void;
    }

    let { onClose }: Props = $props();

    let suspensionDetails = $derived($currentUserStore.suspensionDetails);
    let actionDate = $derived(new Date(Number(suspensionDetails?.action?.timestamp)));
    const actionText = $derived(
        suspensionDetails?.action?.kind === "delete_action" ? "deleted" : "unsuspended",
    );
    let notice = $derived(
        `You can appeal this suspension by sending a direct message to the @OpenChat Twitter account otherwise your account will be ${actionText} on ${actionDate?.toLocaleString()}.`,
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
                    <Body width={"hug"} colour={"primary"}>Reason:</Body>
                    <Body width={"hug"}>{$currentUserStore.suspensionDetails?.reason}</Body>
                </Row>
            {/if}
        </Column>
        <Body colour={"textSecondary"}>{notice}</Body>
    </Column>
</Sheet>
