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
        achievements,
        achievementsStore,
        currentUserIdStore,
        currentUserStore,
        type Achievement,
        type ExternalAchievement,
    } from "openchat-client";
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
    import Translatable from "../../Translatable.svelte";
    import NothingToSee from "../NothingToSee.svelte";

    const client = getContext<OpenChat>("client");
    const enabled = new Set<string>([
        "streak_3",
        "streak_7",
        "streak_14",
        "streak_30",
        "streak_100",
        "streak_365",
        "set_bio",
        "set_avatar",
        "joined_group",
        "joined_community",
        "sent_direct_message",
        "received_direct_message",
        "upgraded_to_diamond",
        "set_display_name",
        "sent_text",
        "reacted_to_message",
        "sent_file",
        "sent_image",
        "sent_poll",
        "sent_crypto",
        "sent_video",
        "sent_audio",
        "sent_giphy",
        "sent_prize",
        "sent_meme",
        "sent_swap_offer",
        "quote_replied",
        "replied_in_thread",
        "edited_message",
        "deleted_message",
        "tipped_message",
        "forwarded_message",
        "proved_unique_personhood",
        "received_crypto",
        "received_reaction",
        "had_message_tipped",
        "voted_on_poll",
        "sent_reminder",
        "set_community_display_name",
        "joined_call",
        "set_pin",
        "favourited_chat",
        "pinned_chat",
        "followed_thread",
        "swapped_from_wallet",
        "accepted_swap_offer",
        "referred_1st_user",
        "referred_3rd_user",
        "referred_10th_user",
        "referred_20th_user",
        "referred_50th_user",
        "upgrade_to_gold_diamond",
    ]);

    interface Props {
        onClose: () => void;
    }
    let { onClose }: Props = $props();

    let selectedTab: "todo" | "done" | "external" = $state("todo");

    function filter(achievement: Achievement): boolean {
        return enabled.has(achievement) || $achievementsStore.has(achievement);
    }

    function selectTab(tab: "todo" | "done" | "external") {
        transition(["fade"], () => {
            selectedTab = tab;
        });
    }

    onMount(() => {
        client.getExternalAchievements().then((achievements) => {
            externalAchievements = achievements.sort((a, b) => b.chitReward - a.chitReward);
        });
    });
    let filtered = $derived([...achievements].filter(filter));
    let [internalAchieved, internalNotAchieved] = $derived(
        client.partition(filtered, (a) => $achievementsStore.has(a)),
    );
    let externalAchievements: ExternalAchievement[] = $state([]);
    let totalAchievements = $derived(filtered.length + externalAchievements.length);
    let [externalAchieved, externalNotAchieved] = $derived(
        client.partition(externalAchievements, (a) => {
            return $achievementsStore.has(a.name);
        }),
    );
    let achieved = $derived([
        ...internalAchieved.map((a) => `learnToEarn.${a}`),
        ...externalAchieved.map((a) => a.name),
    ]);
    let percComplete = $derived(Math.round((achieved.length / totalAchievements) * 100));
    let validExternalNotAchieved = $derived(
        externalNotAchieved.filter((a) => !a.budgetExhausted && BigInt($now) < a.expires),
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
                            <CheckCircle size={"1.3rem"} color={ColourVars.success} />
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
