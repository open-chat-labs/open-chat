<script lang="ts">
    import CheckCircle from "svelte-material-icons/CheckCircle.svelte";
    import CheckCircleOutline from "svelte-material-icons/CheckCircleOutline.svelte";
    import { OpenChat, achievements } from "openchat-client";
    import ModalContent from "../../ModalContent.svelte";
    import Overlay from "../../Overlay.svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Button from "../../Button.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import { iconSize } from "../../../stores/iconSize";
    import Progress from "../../Progress.svelte";

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");

    $: user = client.user;
    $: [achieved, notAchieved] = client.partition([...achievements], (a) =>
        $user.achievements.has(a),
    );
    $: percComplete = Math.floor((achieved.length / achievements.length) * 100);
</script>

<Overlay dismissible>
    <ModalContent closeIcon on:close>
        <span class="header" slot="header"> Learn to earn </span>

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
