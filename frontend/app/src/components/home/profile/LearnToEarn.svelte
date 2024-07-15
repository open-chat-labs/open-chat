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

    import { _ } from "svelte-i18n";

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");

    // this is a temporary hack to filter out everything we don't currently have translations for
    // e.g. things we're not quite ready to switch on yet
    function filter(achievement: string) {
        const key = `learnToEarn.${achievement}`;
        return $_(key) !== key;
    }

    $: filtered = [...achievements].filter(filter);
    $: globalState = client.globalStateStore;
    $: [achieved, notAchieved] = client.partition(filtered, (a) =>
        $globalState.achievements.has(a),
    );
    $: percComplete = Math.floor((achieved.length / filtered.length) * 100);
</script>

<Overlay dismissible>
    <ModalContent closeIcon on:close>
        <span class="header" slot="header">
            <Translatable resourceKey={i18nKey("learnToEarn.title")} />
        </span>

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
