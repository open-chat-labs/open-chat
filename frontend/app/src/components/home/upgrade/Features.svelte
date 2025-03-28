<script lang="ts">
    // import { _ } from "svelte-i18n";
    import Button from "../../Button.svelte";
    import Footer from "./Footer.svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import Minus from "svelte-material-icons/Minus.svelte";
    import { createEventDispatcher } from "svelte";
    import Feature from "./Feature.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";

    const dispatch = createEventDispatcher();

    interface Props {
        isDiamond: boolean;
        canExtend: boolean;
        landing?: boolean;
        onUpgrade: () => void;
    }

    let { isDiamond, canExtend, landing = false, onUpgrade }: Props = $props();

    function cancel() {
        dispatch("cancel");
    }
</script>

<div class:landing class="grid header">
    <div class="header-col"><Translatable resourceKey={i18nKey("upgrade.feature")} /></div>
    <div class="header-col free"><Translatable resourceKey={i18nKey("upgrade.free")} /></div>
    <div class="header-col diamond"><Translatable resourceKey={i18nKey("upgrade.diamond")} /></div>
</div>

<div class:landing class="grid body">
    <Feature {landing}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.textMessages")} />
        {/snippet}
        {#snippet free()}
            <Check size={"1em"} color={"limegreen"} />
        {/snippet}
        {#snippet diamond()}
            <Check size={"1em"} color={"limegreen"} />
        {/snippet}
    </Feature>

    <Feature {landing}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.giphys")} />
        {/snippet}
        {#snippet free()}
            <Check size={"1em"} color={"limegreen"} />
        {/snippet}
        {#snippet diamond()}
            <Check size={"1em"} color={"limegreen"} />
        {/snippet}
    </Feature>

    <Feature {landing}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.reactions")} />
        {/snippet}
        {#snippet free()}
            <Check size={"1em"} color={"limegreen"} />
        {/snippet}
        {#snippet diamond()}
            <Check size={"1em"} color={"limegreen"} />
        {/snippet}
    </Feature>

    <Feature {landing}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.polls")} />
        {/snippet}
        {#snippet free()}
            <Check size={"1em"} color={"limegreen"} />
        {/snippet}
        {#snippet diamond()}
            <Check size={"1em"} color={"limegreen"} />
        {/snippet}
    </Feature>

    <Feature {landing}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.reminders")} />
        {/snippet}
        {#snippet free()}
            <Check size={"1em"} color={"limegreen"} />
        {/snippet}
        {#snippet diamond()}
            <Check size={"1em"} color={"limegreen"} />
        {/snippet}
    </Feature>

    <Feature {landing}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.crypto")} />
        {/snippet}
        {#snippet free()}
            <Check size={"1em"} color={"limegreen"} />
        {/snippet}
        {#snippet diamond()}
            <Check size={"1em"} color={"limegreen"} />
        {/snippet}
    </Feature>

    <Feature {landing}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.videoCalls")} />
        {/snippet}
        {#snippet free()}
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        {/snippet}
        {#snippet diamond()}
            <Check size={"1em"} color={"limegreen"} />
        {/snippet}
    </Feature>

    <Feature {landing}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.notifications")} />
        {/snippet}
        {#snippet free()}
            <Translatable resourceKey={i18nKey("upgrade.freeNotifications")} />
        {/snippet}
        {#snippet diamond()}
            <Translatable resourceKey={i18nKey("upgrade.diamondNotifications")} />
        {/snippet}
    </Feature>

    <Feature
        {landing}
        diamondInfo={i18nKey("upgrade.mediaLimits", { image: "5mb", video: "50mb" })}
        freeInfo={i18nKey("upgrade.mediaLimits", { image: "1mb", video: "5mb" })}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.mediaMessages")} />
        {/snippet}
        {#snippet free()}
            <Translatable resourceKey={i18nKey("upgrade.freeMediaMessages")} />
        {/snippet}
        {#snippet diamond()}
            <Translatable resourceKey={i18nKey("upgrade.diamondMediaMessages")} />
        {/snippet}
    </Feature>

    <Feature
        {landing}
        diamondInfo={i18nKey("upgrade.diamondStorageLimit")}
        freeInfo={i18nKey("upgrade.freeStorageLimit")}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.storage")} />
        {/snippet}
        {#snippet free()}
            <Translatable resourceKey={i18nKey("upgrade.freeStorage")} />
        {/snippet}
        {#snippet diamond()}
            <Translatable resourceKey={i18nKey("upgrade.diamondStorage")} />
        {/snippet}
    </Feature>

    <Feature {landing}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.createCommunities")} />
        {/snippet}
        {#snippet free()}
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        {/snippet}
        {#snippet diamond()}
            <Check size={"1em"} color={"limegreen"} />
        {/snippet}
    </Feature>

    <Feature {landing}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.directChats")} />
        {/snippet}
        {#snippet free()}
            <Check size={"1em"} color={"limegreen"} />
        {/snippet}
        {#snippet diamond()}
            <Check size={"1em"} color={"limegreen"} />
        {/snippet}
    </Feature>

    <Feature {landing}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.privateGroups")} />
        {/snippet}
        {#snippet free()}
            <Translatable resourceKey={i18nKey("upgrade.freePrivateGroups")} />
        {/snippet}
        {#snippet diamond()}
            <Translatable resourceKey={i18nKey("upgrade.diamondPrivateGroups")} />
        {/snippet}
    </Feature>

    <Feature {landing}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.publicGroups")} />
        {/snippet}
        {#snippet free()}
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        {/snippet}
        {#snippet diamond()}
            <Translatable resourceKey={i18nKey("upgrade.diamondPublicGroups")} />
        {/snippet}
    </Feature>

    <Feature {landing}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.gatedGroups")} />
        {/snippet}
        {#snippet free()}
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        {/snippet}
        {#snippet diamond()}
            <Check size={"1em"} color={"limegreen"} />
        {/snippet}
    </Feature>

    <Feature {landing}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.translations")} />
        {/snippet}
        {#snippet free()}
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        {/snippet}
        {#snippet diamond()}
            <Check size={"1em"} color={"limegreen"} />
        {/snippet}
    </Feature>

    <Feature {landing}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.p2pSwap")} />
        {/snippet}
        {#snippet free()}
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        {/snippet}
        {#snippet diamond()}
            <Check size={"1em"} color={"limegreen"} />
        {/snippet}
    </Feature>

    <Feature {landing}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.diamondBadge")} />
        {/snippet}
        {#snippet free()}
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        {/snippet}
        {#snippet diamond()}
            <Check size={"1em"} color={"limegreen"} />
        {/snippet}
    </Feature>

    <Feature {landing} diamondInfo={i18nKey("upgrade.airdropsInfo")}>
        {#snippet title()}
            <Translatable resourceKey={i18nKey("upgrade.airdrops")} />
        {/snippet}
        {#snippet free()}
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        {/snippet}
        {#snippet diamond()}
            <Translatable resourceKey={i18nKey("upgrade.eligible")} />
        {/snippet}
    </Feature>
</div>

{#if !landing}
    <div class="footer">
        <Footer>
            <Button tiny={$mobileWidth} small={!$mobileWidth} secondary on:click={cancel}
                ><Translatable resourceKey={i18nKey(isDiamond ? "close" : "cancel")} /></Button>
            {#if !isDiamond}
                <Button on:click={onUpgrade} tiny={$mobileWidth} small={!$mobileWidth}
                    ><Translatable resourceKey={i18nKey("upgrade.button")} /></Button>
            {:else if canExtend}
                <Button on:click={onUpgrade} tiny={$mobileWidth} small={!$mobileWidth}
                    ><Translatable resourceKey={i18nKey("upgrade.extendShort")} /></Button>
            {/if}
        </Footer>
    </div>
{/if}

<style lang="scss">
    .grid {
        @include font(book, normal, fs-90);
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
    }

    .body {
        padding: 0 $sp5 $sp5 $sp5;
        flex: 1;
        overflow-y: scroll;

        @include mobile() {
            padding: 0 $sp3 $sp3 $sp3;
        }

        &.landing {
            padding: 0;
        }
    }

    .header {
        padding: $sp5 $sp5 0 $sp5;

        @include mobile() {
            padding: $sp3 $sp3 0 $sp3;
        }

        &.landing {
            padding: 0;
            @include font-size(fs-120);
        }
    }
    .header-col {
        font-weight: 700;
        padding: $sp3 $sp2;

        &.free,
        &.diamond {
            text-align: center;
        }

        &.diamond {
            background-color: var(--primary);
            color: #ffffff;
        }
    }
</style>
