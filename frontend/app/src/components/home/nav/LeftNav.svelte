<script lang="ts">
    import FancyLoader from "../../icons/FancyLoader.svelte";
    import TooltipWrapper from "../../TooltipWrapper.svelte";
    import TooltipPopup from "../../TooltipPopup.svelte";
    import { _ } from "svelte-i18n";
    import page from "page";
</script>

<TooltipWrapper position="right" align={"center"}>
    <div slot="target" on:click={() => page("/home")} class="logo">
        <FancyLoader loop={false} />
    </div>
    <div slot="tooltip" let:position let:align>
        <TooltipPopup {position} {align} textLength={100} longestWord={10}>
            {$_("homepage")}
        </TooltipPopup>
    </div>
</TooltipWrapper>

<style type="text/scss">
    .logo {
        cursor: pointer;
        width: toRem(48);
        height: toRem(48);
    }
</style>
