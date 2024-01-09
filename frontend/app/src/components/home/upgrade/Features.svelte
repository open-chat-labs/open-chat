<script lang="ts">
    import { _ } from "svelte-i18n";
    import Button from "../../Button.svelte";
    import Footer from "./Footer.svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import Minus from "svelte-material-icons/Minus.svelte";
    import { createEventDispatcher } from "svelte";
    import Feature from "./Feature.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import Translatable from "../../Translatable.svelte";

    const dispatch = createEventDispatcher();

    export let isDiamond: boolean;
    export let canExtend: boolean;
    export let landing = false;

    function cancel() {
        dispatch("cancel");
    }

    function upgrade() {
        dispatch("upgrade");
    }
</script>

<div class:landing class="grid header">
    <div class="header-col"><Translatable key="upgrade.feature" /></div>
    <div class="header-col free"><Translatable key="upgrade.free" /></div>
    <div class="header-col diamond"><Translatable key="upgrade.diamond" /></div>
</div>

<div class:landing class="grid body">
    <Feature {landing}>
        <div slot="title"><Translatable key="upgrade.textMessages" /></div>
        <div slot="free">
            <Check size={"1em"} color={"limegreen"} />
        </div>
        <div slot="diamond">
            <Check size={"1em"} color={"limegreen"} />
        </div>
    </Feature>

    <Feature {landing}>
        <div slot="title"><Translatable key="upgrade.giphys" /></div>
        <div slot="free">
            <Check size={"1em"} color={"limegreen"} />
        </div>
        <div slot="diamond">
            <Check size={"1em"} color={"limegreen"} />
        </div>
    </Feature>

    <Feature {landing}>
        <div slot="title"><Translatable key="upgrade.reactions" /></div>
        <div slot="free">
            <Check size={"1em"} color={"limegreen"} />
        </div>
        <div slot="diamond">
            <Check size={"1em"} color={"limegreen"} />
        </div>
    </Feature>

    <Feature {landing}>
        <div slot="title"><Translatable key="upgrade.polls" /></div>
        <div slot="free">
            <Check size={"1em"} color={"limegreen"} />
        </div>
        <div slot="diamond">
            <Check size={"1em"} color={"limegreen"} />
        </div>
    </Feature>

    <Feature {landing}>
        <div slot="title"><Translatable key="upgrade.reminders" /></div>
        <div slot="free">
            <Check size={"1em"} color={"limegreen"} />
        </div>
        <div slot="diamond">
            <Check size={"1em"} color={"limegreen"} />
        </div>
    </Feature>

    <Feature {landing}>
        <div slot="title"><Translatable key="upgrade.crypto" /></div>
        <div slot="free">
            <Check size={"1em"} color={"limegreen"} />
        </div>
        <div slot="diamond">
            <Check size={"1em"} color={"limegreen"} />
        </div>
    </Feature>

    <Feature {landing}>
        <div slot="title"><Translatable key="upgrade.notifications" /></div>
        <div slot="free"><Translatable key="upgrade.freeNotifications" /></div>
        <div slot="diamond"><Translatable key="upgrade.diamondNotifications" /></div>
    </Feature>

    <Feature
        {landing}
        diamondInfo={$_("upgrade.mediaLimits", { values: { image: "5mb", video: "50mb" } })}
        freeInfo={$_("upgrade.mediaLimits", { values: { image: "1mb", video: "5mb" } })}>
        <div slot="title"><Translatable key="upgrade.mediaMessages" /></div>
        <div slot="free"><Translatable key="upgrade.freeMediaMessages" /></div>
        <div slot="diamond"><Translatable key="upgrade.diamondMediaMessages" /></div>
    </Feature>

    <Feature
        {landing}
        diamondInfo={$_("upgrade.diamondStorageLimit")}
        freeInfo={$_("upgrade.freeStorageLimit")}>
        <div slot="title"><Translatable key="upgrade.storage" /></div>
        <div slot="free"><Translatable key="upgrade.freeStorage" /></div>
        <div slot="diamond"><Translatable key="upgrade.diamondStorage" /></div>
    </Feature>

    <Feature {landing}>
        <div slot="title"><Translatable key="upgrade.createCommunities" /></div>
        <div slot="free">
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        </div>
        <div slot="diamond">
            <Check size={"1em"} color={"limegreen"} />
        </div>
    </Feature>

    <Feature {landing}>
        <div slot="title"><Translatable key="upgrade.directChats" /></div>
        <div slot="free">
            <Check size={"1em"} color={"limegreen"} />
        </div>
        <div slot="diamond">
            <Check size={"1em"} color={"limegreen"} />
        </div>
    </Feature>

    <Feature {landing}>
        <div slot="title"><Translatable key="upgrade.privateGroups" /></div>
        <div slot="free"><Translatable key="upgrade.freePrivateGroups" /></div>
        <div slot="diamond"><Translatable key="upgrade.diamondPrivateGroups" /></div>
    </Feature>

    <Feature {landing}>
        <div slot="title"><Translatable key="upgrade.publicGroups" /></div>
        <div slot="free">
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        </div>
        <div slot="diamond"><Translatable key="upgrade.diamondPublicGroups" /></div>
    </Feature>

    <Feature {landing}>
        <div slot="title"><Translatable key="upgrade.gatedGroups" /></div>
        <div slot="free">
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        </div>
        <div slot="diamond">
            <Check size={"1em"} color={"limegreen"} />
        </div>
    </Feature>

    <Feature {landing}>
        <div slot="title"><Translatable key="upgrade.translations" /></div>
        <div slot="free">
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        </div>
        <div slot="diamond">
            <Check size={"1em"} color={"limegreen"} />
        </div>
    </Feature>

    <Feature {landing}>
        <div slot="title"><Translatable key="upgrade.diamondBadge" /></div>
        <div slot="free">
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        </div>
        <div slot="diamond">
            <Check size={"1em"} color={"limegreen"} />
        </div>
    </Feature>

    <Feature {landing}>
        <div slot="title"><Translatable key="upgrade.displayNames" /></div>
        <div slot="free">
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        </div>
        <div slot="diamond">
            <Check size={"1em"} color={"limegreen"} />
        </div>
    </Feature>

    <Feature {landing} diamondInfo={$_("upgrade.airdropsInfo")}>
        <div slot="title"><Translatable key="upgrade.airdrops" /></div>
        <div slot="free">
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        </div>
        <div slot="diamond"><Translatable key="upgrade.eligible" /></div>
    </Feature>

    <Feature {landing} comingSoon>
        <div slot="title"><Translatable key="upgrade.customThemes" /></div>
        <div slot="free">
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        </div>
        <div slot="diamond">
            <Check size={"1em"} color={"limegreen"} />
        </div>
    </Feature>

    <Feature {landing} comingSoon>
        <div slot="title"><Translatable key="upgrade.nftProfile" /></div>
        <div slot="free">
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        </div>
        <div slot="diamond">
            <Check size={"1em"} color={"limegreen"} />
        </div>
    </Feature>
</div>

{#if !landing}
    <div class="footer">
        <Footer>
            <Button tiny={$mobileWidth} small={!$mobileWidth} secondary on:click={cancel}
                ><Translatable key={isDiamond ? "close" : "cancel"} /></Button>
            {#if !isDiamond}
                <Button on:click={upgrade} tiny={$mobileWidth} small={!$mobileWidth}
                    ><Translatable key="upgrade.button" /></Button>
            {:else if canExtend}
                <Button on:click={upgrade} tiny={$mobileWidth} small={!$mobileWidth}
                    ><Translatable key="upgrade.extendShort" /></Button>
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
