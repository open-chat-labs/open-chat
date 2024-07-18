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
    import { createEventDispatcher, getContext } from "svelte";
    import { iconSize } from "../../../stores/iconSize";
    import Progress from "../../Progress.svelte";

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");

    const enabled = new Set<Achievement>([
        "streak_3",
        "streak_7",
        "streak_14",
        "streak_30",
        "set_bio",
        "set_avatar",
        "joined_group",
        "joined_community",
        "sent_direct_message",
        "received_direct_message",
        "upgraded_to_diamond",
        "set_display_name",
        "upgrade_to_gold_diamond",
        "sent_text",
        "reacted_to_message",
        "started_call",
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
    ]);

    $: globalState = client.globalStateStore;
    $: filtered = [...achievements].filter(filter);
    $: [achieved, notAchieved] = client.partition(filtered, (a) =>
        $globalState.achievements.has(a),
    );
    $: percComplete = Math.floor((achieved.length / filtered.length) * 100);

    function filter(achievement: Achievement): boolean {
        return enabled.has(achievement) || $globalState.achievements.has(achievement);
    }
</script>

<Overlay dismissible>
    <ModalContent closeIcon on:close>
        <span class="header" slot="header"
            ><Translatable resourceKey={i18nKey("learnToEarn.title")} /></span>

        <div class="body" slot="body">
            {#each achieved as achievement}
                <div class="achievement">
                    <div class="yes icon">
                        <CheckCircle size={$iconSize} color={"var(--toast-success-bg)"} />
                    </div>
                    <Translatable resourceKey={i18nKey(`learnToEarn.${achievement}`)} />
                </div>
            {/each}
            {#each notAchieved as achievement}
                <div class="achievement">
                    <div class="no icon">
                        <CheckCircleOutline size={$iconSize} color={"#ccc"} />
                    </div>
                    <Translatable resourceKey={i18nKey(`learnToEarn.${achievement}`)} />
                </div>
            {/each}
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
</style>
