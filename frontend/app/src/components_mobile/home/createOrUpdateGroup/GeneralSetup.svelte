<script lang="ts">
    import { Container } from "component-lib";
    import { type CandidateGroupChat } from "openchat-client";
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

    <DisappearingMessages bind:candidateGroup />
</Container>
