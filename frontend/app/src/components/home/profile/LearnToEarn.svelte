<script lang="ts">
    import CheckCircle from "svelte-material-icons/CheckCircle.svelte";
    import CheckCircleOutline from "svelte-material-icons/CheckCircleOutline.svelte";
    import { OpenChat, achievements, type Achievement } from "openchat-client";
    import ModalContent from "../../ModalContent.svelte";
    import Overlay from "../../Overlay.svelte";
    import Translatable from "../../Translatable.svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../../i18n/i18n";
    import Button from "../../Button.svelte";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { iconSize } from "../../../stores/iconSize";
    import Progress from "../../Progress.svelte";

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");
    const enabled = new Set<Achievement>([
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
        "accepted_swap_offer",
        "referred_1st_user",
        "referred_3rd_user",
        "referred_10th_user",
        "referred_20th_user",
        "referred_50th_user",
        "upgrade_to_gold_diamond",
    ]);

    let selectedTab: "todo" | "done" = "todo";

    $: globalState = client.globalStateStore;
    $: filtered = [...achievements].filter(filter);
    $: [achieved, notAchieved] = client.partition(filtered, (a) =>
        $globalState.achievements.has(a),
    );
    $: percComplete = Math.floor((achieved.length / filtered.length) * 100);

    function filter(achievement: Achievement): boolean {
        return enabled.has(achievement) || $globalState.achievements.has(achievement);
    }

    function selectTab(tab: "todo" | "done") {
        selectedTab = tab;
    }

    onMount(() => {
        client.getExternalAchievements().then((achievements) => {
            console.log("achievements", achievements);
        });
    });
</script>

<Overlay dismissible>
    <ModalContent closeIcon on:close>
        <span class="header" slot="header"
            ><Translatable resourceKey={i18nKey("learnToEarn.title")} /></span>

        <div class="body" slot="body">
            <div class="tabs">
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <div
                    tabindex="0"
                    role="button"
                    on:click={() => selectTab("todo")}
                    class:selected={selectedTab === "todo"}
                    class="tab">
                    <Translatable resourceKey={i18nKey("learnToEarn.todo")} />
                </div>
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <div
                    tabindex="0"
                    role="button"
                    on:click={() => selectTab("done")}
                    class:selected={selectedTab === "done"}
                    class="tab">
                    <Translatable resourceKey={i18nKey("learnToEarn.done")} />
                </div>
            </div>
            {#if selectedTab === "todo"}
                <div class="list">
                    {#if notAchieved.length === 0}
                        <div class="empty">
                            <div class="emoji">😎</div>
                            <div class="msg">
                                <Translatable
                                    resourceKey={i18nKey("learnToEarn.nothingLeftToDo")} />
                            </div>
                        </div>
                    {:else}
                        {#each notAchieved as achievement}
                            <div class="achievement">
                                <div class="no icon">
                                    <CheckCircleOutline size={$iconSize} color={"#ccc"} />
                                </div>
                                <Translatable resourceKey={i18nKey(`learnToEarn.${achievement}`)} />
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
                                <Translatable resourceKey={i18nKey("learnToEarn.nothingDone")} />
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
                                <Translatable resourceKey={i18nKey(`learnToEarn.${achievement}`)} />
                            </div>
                        {/each}
                    {/if}
                </div>
            {/if}
        </div>

        <span class="footer" slot="footer">
            <div class="perc">
                <Progress size={"45px"} percent={percComplete}>
                    <Translatable
                        resourceKey={i18nKey("learnToEarn.percentageComplete", {
                            perc: percComplete,
                        })} />
                </Progress>
            </div>
            <Button small on:click={() => dispatch("close")}>
                <Translatable resourceKey={i18nKey("close")} />
            </Button>
        </span>
    </ModalContent>
</Overlay>

<style lang="scss">
    .achievement {
        display: flex;
        gap: $sp3;
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
</style>
