<script lang="ts">
    import { i18nKey, interpolate } from "@src/i18n/i18n";
    import { CommonButton, Container, Switch, TextArea } from "component-lib";
    import { publish } from "openchat-client";
    import { _ } from "svelte-i18n";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import Setting from "../Setting.svelte";
    import Translatable from "../Translatable.svelte";
    import SlidingPageContent from "./SlidingPageContent.svelte";
    import { MAX_RULES_LENGTH, type UpdateGroupOrCommunityState } from "./groupOrCommunity.svelte";

    interface Props {
        data: UpdateGroupOrCommunityState;
    }

    let { data }: Props = $props();
</script>

<SlidingPageContent title={i18nKey("Rules", undefined, data.candidate.level, true)}>
    <Container
        supplementalClass={"group_general_setup"}
        height={{ kind: "fill" }}
        gap={"xl"}
        direction={"vertical"}
        padding={["xxl", "lg", "lg", "lg"]}>
        <!-- <GroupCard candidateGroup={ugs.candidateGroup} /> -->

        <Container padding={["zero", "md"]} gap={"xl"} direction={"vertical"}>
            <Setting
                toggle={() => data.toggleRulesEnabled()}
                info={"If enabled, new members must agree to the rules before they can send messages. View example!"}
                title={"Enable rules for the group"}>
                <Switch bind:checked={data.rules.enabled} />
            </Setting>
            {#if data.rules.enabled}
                <Setting
                    toggle={() => data.toggleNewRulesVersion()}
                    info={"rules.promptExistingUsersInstructions"}
                    title={"rules.promptExistingUsers"}>
                    <Switch bind:checked={data.rules.newVersion} />
                </Setting>
            {/if}
        </Container>

        {#if data.rules.enabled}
            <TextArea
                bind:value={data.rules.text}
                minlength={0}
                maxlength={MAX_RULES_LENGTH}
                rows={8}
                error={!data.rulesValid}
                placeholder={interpolate(
                    $_,
                    i18nKey("rules.placeholder", undefined, data.candidate.level, true),
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
