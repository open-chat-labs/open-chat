<script lang="ts">
    import {
        Body,
        BodySmall,
        Chip,
        ColourVars,
        Column,
        Row,
        Sheet,
        Title,
        transition,
    } from "component-lib";
    import {
        OpenChat,
        achievementList,
        achievements,
        achievementsStore,
        currentUserIdStore,
        currentUserStore,
        type ExternalAchievement,
    } from "@client";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import CheckCircle from "svelte-material-icons/CheckCircle.svelte";
    import CheckCircleOutline from "svelte-material-icons/CheckCircleOutline.svelte";
    import InformationOutline from "svelte-material-icons/InformationOutline.svelte";
    import RobotHappy from "svelte-material-icons/RobotHappyOutline.svelte";
    import RobotLove from "svelte-material-icons/RobotLoveOutline.svelte";
    import Tooltip from "../../../components/tooltip/Tooltip.svelte";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import { now } from "../../../stores/time";
    import Progress from "../../Progress.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import NothingToSee from "../NothingToSee.svelte";

    const client = getContext<OpenChat>("client");
    interface Props {
        onClose: () => void;
    }
    let { onClose }: Props = $props();

    let selectedTab: "todo" | "done" | "external" = $state("todo");

    function selectTab(tab: "todo" | "done" | "external") {
        transition(["fade"], () => {
            selectedTab = tab;
        });
    }

    onMount(() => {
        client.getExternalAchievements().then((achievements) => {
            externalAchievements = achievements;
        });
    });
    let externalAchievements: ExternalAchievement[] = $state([]);
    // the old "Learn to earn" list, and what each pays (achievementList in @client)
    let list = $derived(
        achievementList(achievements, $achievementsStore, externalAchievements, $now),
    );
    let internalNotAchieved = $derived(
        list.flatMap((a) => (a.kind === "internal" && !a.done ? [a.id] : [])),
    );
    let achieved = $derived(
        list.flatMap((a) =>
            !a.done ? [] : a.kind === "internal" ? [`learnToEarn.${a.id}`] : [a.name],
        ),
    );
    let percComplete = $derived(Math.round((achieved.length / list.length) * 100));
    let validExternalNotAchieved = $derived(
        list.flatMap((a) =>
            a.kind === "external" && !a.done
                ? externalAchievements.filter((e) => e.id === a.id)
                : [],
        ),
    );
</script>

<Sheet onDismiss={onClose}>
    <Column gap={"lg"} padding={"xl"}>
        <Title fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("learnToEarn.title")} />
        </Title>

        <Row mainAxisAlignment={"spaceAround"} gap={"lg"}>
            <Chip
                width={{ share: 1 }}
                onClick={() => selectTab("todo")}
                mode={"todo" === selectedTab ? "rounded" : "unselected"}>
                <Translatable resourceKey={i18nKey("learnToEarn.todo")} />
            </Chip>
            {#if externalAchievements.length > 0}
                <Chip
                    width={{ share: 2 }}
                    onClick={() => selectTab("external")}
                    mode={"external" === selectedTab ? "rounded" : "unselected"}>
                    <Row
                        mainAxisAlignment={"center"}
                        width={"hug"}
                        crossAxisAlignment={"center"}
                        gap={"xs"}>
                        <Translatable resourceKey={i18nKey("learnToEarn.external")} />
                        <Tooltip position={"bottom"} align={"end"}>
                            <InformationOutline
                                size={"1.2em"}
                                color={selectedTab === "external"
                                    ? ColourVars.primary
                                    : ColourVars.textSecondary} />
                            {#snippet popupTemplate()}
                                <Translatable resourceKey={i18nKey("learnToEarn.externalInfo")} />
                            {/snippet}
                        </Tooltip>
                    </Row>
                </Chip>
            {/if}
            <Chip
                width={{ share: 1 }}
                onClick={() => selectTab("done")}
                mode={"done" === selectedTab ? "rounded" : "unselected"}>
                <Translatable resourceKey={i18nKey("learnToEarn.done")} />
            </Chip>
        </Row>

        {#if selectedTab === "todo"}
            {#if internalNotAchieved.length === 0}
                <NothingToSee
                    padding={["xl", "zero"]}
                    height={{ size: "12rem" }}
                    title={"Good job!"}
                    subtitle={interpolate($_, i18nKey("learnToEarn.nothingLeftToDo"))}>
                    {#snippet icon(color, size)}
                        <RobotHappy {color} {size} />
                    {/snippet}
                </NothingToSee>
            {:else}
                <Column gap={"sm"} maxHeight={"25rem"}>
                    {#each internalNotAchieved as achievement}
                        <Row crossAxisAlignment={"center"} gap={"sm"}>
                            <CheckCircleOutline size={"1.3rem"} color={ColourVars.textPrimary} />
                            <Body>
                                <Translatable resourceKey={i18nKey(`learnToEarn.${achievement}`)} />
                            </Body>
                        </Row>
                    {/each}
                </Column>
            {/if}
        {/if}
        {#if selectedTab === "done"}
            {#if achieved.length === 0}
                <NothingToSee
                    padding={["xl", "zero"]}
                    height={{ size: "12rem" }}
                    title={"Keep trying!"}
                    subtitle={interpolate($_, i18nKey("learnToEarn.nothingDone"))}>
                    {#snippet icon(color, size)}
                        <RobotLove {color} {size} />
                    {/snippet}
                </NothingToSee>
            {:else}
                <Column gap={"sm"} maxHeight={"25rem"}>
                    {#each achieved as achievement}
                        <Row crossAxisAlignment={"center"} gap={"sm"}>
                            <CheckCircle size={"1.3rem"} color={ColourVars.validationSuccess} />
                            <Body>
                                <Translatable resourceKey={i18nKey(achievement)} />
                            </Body>
                        </Row>
                    {/each}
                </Column>
            {/if}
        {/if}
        {#if selectedTab === "external"}
            {#if validExternalNotAchieved.length === 0}
                <NothingToSee
                    padding={["xl", "zero"]}
                    height={{ size: "12rem" }}
                    title={"Good job!"}
                    subtitle={interpolate($_, i18nKey("learnToEarn.nothingLeftToDo"))}>
                    {#snippet icon(color, size)}
                        <RobotHappy {color} {size} />
                    {/snippet}
                </NothingToSee>
            {:else}
                <Column gap={"sm"} maxHeight={"25rem"}>
                    {#each validExternalNotAchieved as achievement}
                        <Row crossAxisAlignment={"center"} gap={"sm"}>
                            <img
                                class="logo"
                                src={client.achievementLogo(achievement.id)}
                                alt={achievement.name} />
                            <a
                                target={"_blank"}
                                href={`${achievement.url}?oc_userid=${$currentUserIdStore}&oc_username=${$currentUserStore.username}`}>
                                {achievement.name}
                            </a>
                            <Body>
                                {achievement.chitReward.toLocaleString()}
                            </Body>
                        </Row>
                    {/each}
                </Column>
            {/if}
        {/if}
        <Column padding={["md", "zero"]} gap={"sm"}>
            <Progress size={"0.5rem"} percent={percComplete}></Progress>
            <BodySmall align={"center"} colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey("learnToEarn.percentageComplete", {
                        perc: percComplete,
                    })} />
            </BodySmall>
        </Column>
    </Column>
</Sheet>

<style lang="scss">
    .logo {
        width: toRem(20);
        height: toRem(20);
    }
</style>
