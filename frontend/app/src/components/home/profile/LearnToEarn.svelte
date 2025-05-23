<script lang="ts">
    import {
        OpenChat,
        achievements,
        achievementsStore,
        currentUserIdStore,
        currentUserStore,
        iconSize,
        type Achievement,
        type ExternalAchievement,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import CheckCircle from "svelte-material-icons/CheckCircle.svelte";
    import CheckCircleOutline from "svelte-material-icons/CheckCircleOutline.svelte";
    import InformationOutline from "svelte-material-icons/InformationOutline.svelte";
    import Tooltip from "../../../components/tooltip/Tooltip.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { now } from "../../../stores/time";
    import Button from "../../Button.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Overlay from "../../Overlay.svelte";
    import Progress from "../../Progress.svelte";
    import Translatable from "../../Translatable.svelte";
    import ExternalLink from "../../landingpages/ExternalLink.svelte";

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
        selectedTab = tab;
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

<Overlay {onClose} dismissible>
    <ModalContent closeIcon {onClose}>
        {#snippet header()}
            <span class="header"><Translatable resourceKey={i18nKey("learnToEarn.title")} /></span>
        {/snippet}

        {#snippet body()}
            <div class="body">
                <div class="tabs">
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <div
                        tabindex="0"
                        role="button"
                        onclick={() => selectTab("todo")}
                        class:selected={selectedTab === "todo"}
                        class="tab">
                        <Translatable resourceKey={i18nKey("learnToEarn.todo")} />
                    </div>
                    {#if externalAchievements.length > 0}
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <div
                            tabindex="0"
                            role="button"
                            onclick={() => selectTab("external")}
                            class:selected={selectedTab === "external"}
                            class="tab">
                            <Translatable resourceKey={i18nKey("learnToEarn.external")} />
                            <div class="icon">
                                <Tooltip position={"bottom"} align={"end"}>
                                    <InformationOutline
                                        size={"1.2em"}
                                        color={selectedTab === "external"
                                            ? "var(--txt)"
                                            : "var(--txt-light)"} />
                                    {#snippet popupTemplate()}
                                        <Translatable
                                            resourceKey={i18nKey("learnToEarn.externalInfo")} />
                                    {/snippet}
                                </Tooltip>
                            </div>
                        </div>
                    {/if}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <div
                        tabindex="0"
                        role="button"
                        onclick={() => selectTab("done")}
                        class:selected={selectedTab === "done"}
                        class="tab">
                        <Translatable resourceKey={i18nKey("learnToEarn.done")} />
                    </div>
                </div>
                {#if selectedTab === "todo"}
                    <div class="list">
                        {#if internalNotAchieved.length === 0}
                            <div class="empty">
                                <div class="emoji">😎</div>
                                <div class="msg">
                                    <Translatable
                                        resourceKey={i18nKey("learnToEarn.nothingLeftToDo")} />
                                </div>
                            </div>
                        {:else}
                            {#each internalNotAchieved as achievement}
                                <div class="achievement">
                                    <div class="no icon">
                                        <CheckCircleOutline size={$iconSize} color={"#ccc"} />
                                    </div>
                                    <Translatable
                                        resourceKey={i18nKey(`learnToEarn.${achievement}`)} />
                                </div>
                            {/each}
                        {/if}
                    </div>
                {/if}
                {#if selectedTab === "done"}
                    <div class="list">
                        {#if achieved.length === 0}
                            <div class="empty">
                                <div class="emoji">😢</div>
                                <div class="msg">
                                    <Translatable
                                        resourceKey={i18nKey("learnToEarn.nothingDone")} />
                                </div>
                            </div>
                        {:else}
                            {#each achieved as achievement}
                                <div class="achievement">
                                    <div class="yes icon">
                                        <CheckCircle
                                            size={$iconSize}
                                            color={"var(--toast-success-bg)"} />
                                    </div>
                                    <Translatable resourceKey={i18nKey(achievement)} />
                                </div>
                            {/each}
                        {/if}
                    </div>
                {/if}
                {#if selectedTab === "external"}
                    <div class="list">
                        {#if validExternalNotAchieved.length === 0}
                            <div class="empty">
                                <div class="emoji">😎</div>
                                <div class="msg">
                                    <Translatable
                                        resourceKey={i18nKey("learnToEarn.nothingLeftToDo")} />
                                </div>
                            </div>
                        {:else}
                            {#each validExternalNotAchieved as achievement}
                                <div class="achievement external">
                                    <div class="external icon">
                                        <img
                                            class="logo"
                                            src={client.achievementLogo(achievement.id)}
                                            alt={achievement.name} />
                                        <ExternalLink
                                            iconColor={"var(--txt)"}
                                            href={`${achievement.url}?oc_userid=${$currentUserIdStore}&oc_username=${$currentUserStore.username}`}>
                                            {achievement.name}
                                        </ExternalLink>
                                        <div class="reward">
                                            {achievement.chitReward.toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            {/each}
                        {/if}
                    </div>
                {/if}
            </div>
        {/snippet}

        {#snippet footer()}
            <span class="footer">
                <div class="perc">
                    <Progress size={"45px"} percent={percComplete}>
                        <Translatable
                            resourceKey={i18nKey("learnToEarn.percentageComplete", {
                                perc: percComplete,
                            })} />
                    </Progress>
                </div>
                <Button small onClick={onClose}>
                    <Translatable resourceKey={i18nKey("close")} />
                </Button>
            </span>
        {/snippet}
    </ModalContent>
</Overlay>

<style lang="scss">
    :global(.tab .icon .noselect) {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .achievement {
        display: flex;
        gap: $sp3;

        &.external {
            margin-bottom: $sp2;
        }
    }

    .perc {
        flex: auto;
        color: var(--txt);
    }

    .footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: $sp4;
    }

    .tabs {
        display: flex;
        align-items: center;
        @include font(medium, normal, fs-90);
        color: var(--txt-light);
        gap: $sp5;
        border-bottom: 1px solid var(--bd);
        cursor: pointer;
        margin-bottom: $sp5;

        @include mobile() {
            gap: $sp4;
        }

        .tab {
            padding-bottom: 10px;
            margin-bottom: -2px;
            border-bottom: 3px solid transparent;
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: $sp2;

            &.selected {
                color: var(--txt);
                border-bottom: 3px solid var(--txt);
            }
        }
    }

    .list {
        height: 400px;
        @include nice-scrollbar();
    }

    .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        padding: 0 25%;
        gap: $sp4;
        text-align: center;

        .emoji {
            @include font(book, normal, fs-260);
        }
        .msg {
            @include font(bold, normal, fs-140);
        }
    }

    .logo {
        width: toRem(20);
        height: toRem(20);
    }

    .external {
        display: flex;
        align-items: center;
        gap: $sp3;
    }

    .reward {
        background-color: var(--button-bg);
        color: var(--button-txt);
        padding: $sp1 $sp2;
        border-radius: $sp2;
        @include font(light, normal, fs-70);
    }
</style>
