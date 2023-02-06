<script lang="ts">
    import TooltipWrapper from "../../TooltipWrapper.svelte";
    import TooltipPopup from "../../TooltipPopup.svelte";
    import Help from "svelte-material-icons/HelpCircleOutline.svelte";
    import { rtlStore } from "../../../stores/rtl";
</script>

<TooltipWrapper alignRight={!$rtlStore} bottomOffset={-4} centreChevron={true}>
    <div slot="target" on:click class="help">
        <Help />
    </div>
    <div slot="tooltip">
        <TooltipPopup alignRight={!$rtlStore} textLength={100} longestWord={10}>
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
