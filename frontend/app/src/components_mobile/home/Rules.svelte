<script lang="ts">
    import { i18nKey, interpolate } from "@src/i18n/i18n";
    import {
        BodySmall,
        ColourVars,
        CommonButton,
        Container,
        Sheet,
        Subtitle,
        Switch,
        TextArea,
    } from "component-lib";
    import { publish } from "openchat-client";
    import { _ } from "svelte-i18n";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import ContentCopy from "svelte-material-icons/ContentCopy.svelte";
    import Eye from "svelte-material-icons/EyeOutline.svelte";
    import Setting from "../Setting.svelte";
    import Translatable from "../Translatable.svelte";
    import { UpdateGroupState } from "./createOrUpdateGroup/group.svelte";
    import GroupCard from "./createOrUpdateGroup/GroupCard.svelte";
    import { MAX_RULES_LENGTH, type UpdateGroupOrCommunityState } from "./groupOrCommunity.svelte";
    import Markdown from "./Markdown.svelte";
    import SlidingPageContent from "./SlidingPageContent.svelte";

    interface Props {
        data: UpdateGroupOrCommunityState;
    }

    let { data }: Props = $props();

    let showExampleRules = $state(false);

    function useExampleRules() {
        data.enableDefaultRules();
        showExampleRules = false;
    }
</script>

{#if showExampleRules}
    <Sheet onDismiss={() => (showExampleRules = false)}>
        <Container height={{ kind: "hug" }} padding={"xl"} gap={"xl"} direction={"vertical"}>
            <Subtitle fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("Example rules")} />
            </Subtitle>

            <BodySmall colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey(
                        "Below are the example rules to showcase what they potentially might be. If you would like to use these rules, or modify them for your particular group, feel free to do so!",
                    )} />
            </BodySmall>

            <Container padding={"lg"} borderRadius={"md"} background={ColourVars.background0}>
                <BodySmall colour={"textSecondary"}>
                    <Markdown inline={false} text={data.defaultRules.text}></Markdown>
                </BodySmall>
            </Container>

            <Container gap={"md"} crossAxisAlignment={"end"} mainAxisAlignment={"end"}>
                <CommonButton
                    onClick={() => (showExampleRules = false)}
                    mode="default"
                    size={"small_text"}>
                    <Translatable resourceKey={i18nKey("cancel")}></Translatable>
                </CommonButton>
                <CommonButton mode={"active"} onClick={useExampleRules} size={"medium"}>
                    {#snippet icon(color)}
                        <ContentCopy {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("Use example rules")} />
                </CommonButton>
            </Container>
        </Container>
    </Sheet>
{/if}

<SlidingPageContent title={i18nKey("Rules", undefined, data.candidate.level, true)}>
    <Container
        supplementalClass={"group_general_setup"}
        height={{ kind: "fill" }}
        gap={"xl"}
        direction={"vertical"}
        padding={["xxl", "lg", "lg", "lg"]}>
        {#if data instanceof UpdateGroupState}
            <GroupCard candidateGroup={data.candidateGroup} />
        {/if}

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

        <Container
            padding={["xl", "zero", "zero", "zero"]}
            mainAxisAlignment={"spaceBetween"}
            crossAxisAlignment={"center"}>
            <CommonButton
                onClick={() => (showExampleRules = true)}
                mode="default"
                size={"small_text"}>
                {#snippet icon(color)}
                    <Eye {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("View example")}></Translatable>
            </CommonButton>
            <CommonButton onClick={() => publish("closeModalPage")} mode="active" size={"medium"}>
                {#snippet icon(color)}
                    <ArrowLeft {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Done, go back")}></Translatable>
            </CommonButton>
        </Container>
    </Container>
</SlidingPageContent>
