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

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");

    $: user = client.user;
    $: achieved = achievements.filter((a) => $user.achievements.has(a));
    $: notAchieved = achievements.filter((a) => !$user.achievements.has(a));
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

        <span slot="footer">
            <Button on:click={() => dispatch("close")}>
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
</style>
