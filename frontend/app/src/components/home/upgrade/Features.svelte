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

<div class="body">
    <div class="header">{$_("upgrade.feature")}</div>
    <div class="header free">{$_("upgrade.free")}</div>
    <div class="header diamond">{$_("upgrade.diamond")}</div>

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
        <div slot="title">{$_("upgrade.translations")}</div>
        <div slot="free">
            <Minus size={"1em"} color={"var(--menu-warn)"} />
        </div>
        <div slot="diamond">
            <Check size={"1em"} color={"limegreen"} />
        </div>
    </Feature>

    <Feature>
        <div slot="title">{$_("upgrade.crypto")}</div>
        <div slot="free">{$_("upgrade.chatAndIcp")}</div>
        <div slot="diamond">{$_("upgrade.allSupportedTokens")}</div>
    </Feature>

    <Feature>
        <div slot="title">{$_("upgrade.polls")}</div>
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

<style type="text/scss">
    .body {
        @include font(book, normal, fs-90);
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        padding: $sp4 $sp5 $sp5 $sp5;

        @include mobile() {
            padding: $sp3;
        }

        .header {
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
    }
</style>
