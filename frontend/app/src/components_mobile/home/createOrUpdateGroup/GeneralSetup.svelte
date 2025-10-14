<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { CommonButton, Container, Switch } from "component-lib";
    import { publish } from "openchat-client";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import Setting from "../../Setting.svelte";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import DisappearingMessages from "./DisappearingMessages.svelte";
    import GroupCard from "./GroupCard.svelte";
    import { updateGroupState } from "./group.svelte";

    let ugs = updateGroupState;
</script>

<SlidingPageContent title={i18nKey("General setup")} subtitle={i18nKey("Create group")}>
    <Container
        supplementalClass={"group_general_setup"}
        height={{ kind: "fill" }}
        gap={"xl"}
        direction={"vertical"}
        padding={["xxl", "lg", "lg", "lg"]}>
        <GroupCard candidate={ugs.candidateGroup} />

        <Container padding={["zero", "md"]} gap={"xxl"} direction={"vertical"}>
            <Setting
                toggle={() =>
                    (ugs.candidateGroup.historyVisible = !ugs.candidateGroup.historyVisible)}
                info={"By default new memebers in the group will see all the previous messages that were sent within the group. Enable this option to hide chat history for new members."}
                title={"Hide chat history for new members"}>
                <Switch bind:checked={ugs.candidateGroup.historyVisible} />
            </Setting>

            <DisappearingMessages />
        </Container>

        <Container padding={["xl", "zero", "zero", "zero"]} mainAxisAlignment={"end"}>
            <CommonButton
                onClick={() => publish("closeModalPage")}
                mode="active"
                size={"small_text"}>
                {#snippet icon(color)}
                    <ArrowLeft {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Done, go back")}></Translatable>
            </CommonButton>
        </Container>
    </Container>
</SlidingPageContent>
