<script lang="ts">
    import { i18nKey, interpolate } from "@src/i18n/i18n";
    import { CommonButton, Container, Switch, TextArea } from "component-lib";
    import { type CandidateGroupChat } from "openchat-client";
    import { _ } from "svelte-i18n";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import Setting from "../../Setting.svelte";
    import Translatable from "../../Translatable.svelte";
    import GroupCard from "./GroupCard.svelte";

    const MAX_RULES_LENGTH = 1024;

    interface Props {
        candidateGroup: CandidateGroupChat;
        onBack: () => void;
    }

    let { candidateGroup = $bindable(), onBack }: Props = $props();
</script>

<Container
    supplementalClass={"group_general_setup"}
    height={{ kind: "fill" }}
    gap={"xl"}
    direction={"vertical"}
    padding={["xxl", "lg", "lg", "lg"]}>
    <GroupCard {candidateGroup} />

    <Container padding={["zero", "md"]} gap={"xl"} direction={"vertical"}>
        <Setting
            toggle={() => (candidateGroup.rules.enabled = !candidateGroup.rules.enabled)}
            info={"If enabled, new members must agree to the rules before they can send messages. View example!"}
            title={"Enable rules for the group"}>
            <Switch bind:checked={candidateGroup.rules.enabled} />
        </Setting>
        {#if candidateGroup.rules.enabled}
            <Setting
                toggle={() => (candidateGroup.rules.newVersion = !candidateGroup.rules.newVersion)}
                info={"rules.promptExistingUsersInstructions"}
                title={"rules.promptExistingUsers"}>
                <Switch bind:checked={candidateGroup.rules.newVersion} />
            </Setting>
        {/if}
    </Container>

    {#if candidateGroup.rules.enabled}
        <TextArea
            bind:value={candidateGroup.rules.text}
            minlength={0}
            maxlength={MAX_RULES_LENGTH}
            rows={8}
            placeholder={interpolate(
                $_,
                i18nKey("rules.placeholder", undefined, candidateGroup.level, true),
            )}>
            {#snippet subtext()}
                <Translatable
                    resourceKey={i18nKey(
                        "Markdown supported. Clear and unambiguous rules work best",
                    )}></Translatable>
            {/snippet}
        </TextArea>
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
