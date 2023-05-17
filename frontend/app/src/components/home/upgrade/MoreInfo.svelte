<script lang="ts">
    import TooltipWrapper from "../../TooltipWrapper.svelte";
    import TooltipPopup from "../../TooltipPopup.svelte";
    import Help from "svelte-material-icons/HelpCircleOutline.svelte";
</script>

<TooltipWrapper position={"top"} align={"end"}>
    <div slot="target" on:click class="help">
        <Help />
    </div>
    <div let:position let:align slot="tooltip">
        <TooltipPopup {position} {align} textLength={100} longestWord={10}>
            <slot />
        </TooltipPopup>
    </div>
</TooltipWrapper>

<style type="text/scss">
    .help {
        cursor: pointer;
        margin: 2px 4px -2px 4px;
    }
</style>
