<script lang="ts">
    import { _ } from "svelte-i18n";
    import Button from "../../Button.svelte";
    import Footer from "./Footer.svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import Minus from "svelte-material-icons/Minus.svelte";
    import { createEventDispatcher } from "svelte";
    import Feature from "./Feature.svelte";
    import { mobileWidth } from "../../../stores/screenDimensions";

    const dispatch = createEventDispatcher();

    export let isDiamond: boolean;
    export let canExtend: boolean;

    function cancel() {
        dispatch("cancel");
    }

    function upgrade() {
        dispatch("upgrade");
    }
</script>

<div class="grid header">
    <div class="header-col">{$_("upgrade.feature")}</div>
    <div class="header-col free">{$_("upgrade.free")}</div>
    <div class="header-col diamond">{$_("upgrade.diamond")}</div>
</div>

<div class="grid body">
    <Feature>
        <div slot="title">{$_("upgrade.textMessages")}</div>
        <div slot="free">
            <Check size={"1em"} color={"limegreen"} />
        </div>
        <div slot="diamond">
            <Check size={"1em"} color={"limegreen"} />
        </div>
    </Feature>

    <Feature>
        <div slot="title">{$_("upgrade.giphys")}</div>
        <div slot="free">
            <Check size={"1em"} color={"limegreen"} />
        </div>
        <div slot="diamond">
            <Check size={"1em"} color={"limegreen"} />
        </div>
    </Feature>

    <Feature>
        <div slot="title">{$_("upgrade.reactions")}</div>
        <div slot="free">
            <Check size={"1em"} color={"limegreen"} />
        </div>
        <div slot="diamond">
            <Check size={"1em"} color={"limegreen"} />
        </div>
    </Feature>

    <Feature>
        <div slot="title">{$_("upgrade.polls")}</div>
        <div slot="free">
            <Check size={"1em"} color={"limegreen"} />
        </div>
        <div slot="diamond">
            <Check size={"1em"} color={"limegreen"} />
        </div>
    </Feature>

    <Feature>
        <div slot="title">{$_("upgrade.reminders")}</div>
        <div slot="free">
            <Check size={"1em"} color={"limegreen"} />
        </div>
        <div slot="diamond">
            <Check size={"1em"} color={"limegreen"} />
        </div>
    </Feature>

    <Feature>
        <div slot="title">{$_("upgrade.crypto")}</div>
        <div slot="free">
            <Check size={"1em"} color={"limegreen"} />
        </div>
        <div slot="diamond">
            <Check size={"1em"} color={"limegreen"} />
        </div>
    </Feature>

    <Feature>
        <div slot="title">{$_("upgrade.notifications")}</div>
        <div slot="free">{$_("upgrade.freeNotifications")}</div>
        <div slot="diamond">{$_("upgrade.diamondNotifications")}</div>
    </Feature>

    <Feature
        diamondInfo={$_("upgrade.mediaLimits", { values: { image: "5mb", video: "50mb" } })}
        freeInfo={$_("upgrade.mediaLimits", { values: { image: "1mb", video: "5mb" } })}>
        <div slot="title">{$_("upgrade.mediaMessages")}</div>
        <div slot="free">{$_("upgrade.freeMediaMessages")}</div>
        <div slot="diamond">{$_("upgrade.diamondMediaMessages")}</div>
    </Feature>

    <Feature
        diamondInfo={$_("upgrade.diamondStorageLimit")}
        freeInfo={$_("upgrade.freeStorageLimit")}>
        <div slot="title">{$_("upgrade.storage")}</div>
        <div slot="free">{$_("upgrade.freeStorage")}</div>
        <div slot="diamond">{$_("upgrade.diamondStorage")}</div>
    </Feature>

    <Feature>
        <div slot="title">{$_("upgrade.directChats")}</div>
        <div slot="free">
            <Check size={"1em"} color={"limegreen"} />
        </div>
        <div slot="diamond">
            <Check size={"1em"} color={"limegreen"} />
        </div>
    </Feature>

    <Feature>
        <div slot="title">{$_("upgrade.privateGroups")}</div>
        <div slot="free">{$_("upgrade.freePrivateGroups")}</div>
        <div slot="diamond">{$_("upgrade.diamondPrivateGroups")}</div>
    </Feature>

    <Feature>
        <div slot="title">{$_("upgrade.publicGroups")}</div>
        <div slot="free">
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        </div>
        <div slot="diamond">{$_("upgrade.diamondPublicGroups")}</div>
    </Feature>

    <Feature>
        <div slot="title">{$_("upgrade.gatedGroups")}</div>
        <div slot="free">
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        </div>
        <div slot="diamond">
            <Check size={"1em"} color={"limegreen"} />
        </div>
    </Feature>

    <Feature>
        <div slot="title">{$_("upgrade.translations")}</div>
        <div slot="free">
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        </div>
        <div slot="diamond">
            <Check size={"1em"} color={"limegreen"} />
        </div>
    </Feature>

    <Feature>
        <div slot="title">{$_("upgrade.diamondBadge")}</div>
        <div slot="free">
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        </div>
        <div slot="diamond">
            <Check size={"1em"} color={"limegreen"} />
        </div>
    </Feature>

    <Feature diamondInfo={$_("upgrade.airdropsInfo")}>
        <div slot="title">{$_("upgrade.airdrops")}</div>
        <div slot="free">
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        </div>
        <div slot="diamond">{$_("upgrade.eligible")}</div>
    </Feature>

    <Feature comingSoon>
        <div slot="title">{$_("upgrade.customThemes")}</div>
        <div slot="free">
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        </div>
        <div slot="diamond">
            <Check size={"1em"} color={"limegreen"} />
        </div>
    </Feature>

    <Feature comingSoon>
        <div slot="title">{$_("upgrade.nftProfile")}</div>
        <div slot="free">
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        </div>
        <div slot="diamond">
            <Check size={"1em"} color={"limegreen"} />
        </div>
    </Feature>
</div>

<div class="footer">
    <Footer>
        <Button tiny={$mobileWidth} small={!$mobileWidth} secondary={true} on:click={cancel}
            >{isDiamond ? $_("close") : $_("cancel")}</Button>
        {#if !isDiamond}
            <Button on:click={upgrade} tiny={$mobileWidth} small={!$mobileWidth}
                >{$_("upgrade.button")}</Button>
        {:else if canExtend}
            <Button on:click={upgrade} tiny={$mobileWidth} small={!$mobileWidth}
                >{$_("upgrade.extendShort")}</Button>
        {/if}
    </Footer>
</div>

<style type="text/scss">
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
    }

    .header {
        padding: $sp5 $sp5 0 $sp5;

        @include mobile() {
            padding: $sp3 $sp3 0 $sp3;
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
