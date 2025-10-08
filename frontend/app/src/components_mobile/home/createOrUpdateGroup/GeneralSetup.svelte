<script lang="ts">
    import { Container, Switch } from "component-lib";
    import { type CandidateGroupChat } from "openchat-client";
    import Setting from "../../Setting.svelte";
    import DisappearingMessages from "./DisappearingMessages.svelte";
    import GroupCard from "./GroupCard.svelte";

    interface Props {
        candidateGroup: CandidateGroupChat;
    }

    let { candidateGroup = $bindable() }: Props = $props();
</script>

<Container
    supplementalClass={"group_general_setup"}
    height={{ kind: "fill" }}
    gap={"xl"}
    direction={"vertical"}
    padding={["xxl", "lg", "lg", "lg"]}>
    <GroupCard {candidateGroup} />

    <Setting
        toggle={() => (candidateGroup.historyVisible = !candidateGroup.historyVisible)}
        info={"By default new memebers in the group will see all the previous messages that were sent within the group. Enable this option to hide chat history for new members."}
        title={"Hide chat history for new members"}>
        <Switch bind:checked={candidateGroup.historyVisible} />
    </Setting>

    <DisappearingMessages bind:candidateGroup />
</Container>
