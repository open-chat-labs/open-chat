<script lang="ts">
    import TooltipWrapper from "../../TooltipWrapper.svelte";
    import TooltipPopup from "../../TooltipPopup.svelte";
    import Avatar from "../../Avatar.svelte";
    import { AvatarSize } from "openchat-client";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    export let community: { name: string; url: string };
    export let selected = false;

    $: avatarSize = $mobileWidth ? AvatarSize.Small : AvatarSize.Default;

    function selectCommunity() {
        dispatch("selectCommunity", community);
    }
</script>

<TooltipWrapper gutter={-6} fill position="right" align={"center"}>
    <div class:selected slot="target" on:click={selectCommunity} class="hover logo">
        <Avatar {selected} url={community.url} size={avatarSize} />
    </div>
    <div slot="tooltip" let:position let:align>
        <TooltipPopup {position} {align}>
            {community.name}
        </TooltipPopup>
    </div>
</TooltipWrapper>

<style type="text/scss">
    .hover {
        cursor: pointer;
        text-align: center;
        padding: toRem(12) 0;
        transition: background-color 250ms ease-in-out;

        &.selected {
            background-color: var(--chatSummary-bg-selected);
        }
    }
</style>
