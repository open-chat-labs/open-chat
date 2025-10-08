<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Body, BodySmall, CommonButton, Container } from "component-lib";
    import { currentUserStore, publish, type CandidateGroupChat } from "openchat-client";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import DiamondOutline from "svelte-material-icons/DiamondOutline.svelte";
    import MulticolourText from "../../MulticolourText.svelte";
    import SparkleBox from "../../SparkleBox.svelte";
    import Translatable from "../../Translatable.svelte";
    import GroupCard from "./GroupCard.svelte";

    interface Props {
        candidateGroup: CandidateGroupChat;
        onBack: () => void;
    }

    let { candidateGroup = $bindable(), onBack }: Props = $props();
    let diamond = $derived($currentUserStore.diamondStatus.kind !== "inactive");
</script>

<Container
    supplementalClass={"group_general_setup"}
    height={{ kind: "fill" }}
    gap={"xl"}
    direction={"vertical"}
    padding={["xxl", "lg", "lg", "lg"]}>
    <GroupCard {candidateGroup} />

    <Container gap={"sm"} direction={"vertical"}>
        <Body colour={diamond ? "textPrimary" : "textTertiary"} fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("Access gates")}></Translatable>
        </Body>

        <BodySmall colour={diamond ? "textSecondary" : "textTertiary"}>
            <Translatable
                resourceKey={i18nKey(
                    "Control who can join your group with a set of well defined access gates. Access gates provide a way to fine tune the profile of users you would want to have in your group. Users explicitly invited to this group will not be required to pass access gates.",
                )}></Translatable>
        </BodySmall>
    </Container>

    {#if !diamond}
        <SparkleBox buttonText={i18nKey("Get Diamond")} onClick={() => publish("upgrade")}>
            {#snippet title()}
                <MulticolourText
                    parts={[
                        {
                            text: i18nKey("Upgrade to "),
                            colour: "primaryLight",
                        },
                        {
                            text: i18nKey("Diamond"),
                            colour: "secondary",
                        },
                    ]} />
            {/snippet}
            {#snippet body()}
                <MulticolourText
                    parts={[
                        {
                            text: i18nKey("Only diamond members can add access gates."),
                            colour: "primaryLight",
                        },
                        {
                            text: i18nKey("Join now!"),
                            colour: "textPrimary",
                        },
                    ]} />
            {/snippet}
            {#snippet buttonIcon(color)}
                <DiamondOutline {color} />
            {/snippet}
        </SparkleBox>
    {:else}
        Diamond member
    {/if}

    <Container padding={["xl", "zero", "zero", "zero"]} mainAxisAlignment={"end"}>
        <CommonButton onClick={onBack} mode="active" size={"small_text"}>
            {#snippet icon(color)}
                <ArrowLeft {color} />
            {/snippet}
            <Translatable resourceKey={i18nKey("Done, go back")}></Translatable>
        </CommonButton>
    </Container>
</Container>
