<script lang="ts">
    import Close from "svelte-material-icons/Close.svelte";
    import BellRingOutline from "svelte-material-icons/BellRingOutline.svelte";
    import Kebab from "svelte-material-icons/DotsVertical.svelte";
    import CheckboxMultipleMarked from "svelte-material-icons/CheckboxMultipleMarked.svelte";
    import { _ } from "svelte-i18n";
    import { OpenChat } from "openchat-client";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import MenuIcon from "../../MenuIcon.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Menu from "../../Menu.svelte";
    import MenuItem from "../../MenuItem.svelte";
    import { activityFeedShowing } from "../../../stores/activity";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let canMarkAllRead = true;

    onMount(() => {
        client.messageActivityFeed().then((resp) => {
            console.log("MessageActivity", resp);
        });
    });
</script>

<SectionHeader slim border={false}>
    <div class="header">
        <div class="icon">
            <BellRingOutline size={$iconSize} color={"var(--icon-txt)"} />
        </div>
        <div class="details">
            <h4 class="name"><Translatable resourceKey={i18nKey("activity.title")} /></h4>
        </div>
        <span class="menu">
            <MenuIcon position="bottom" align="end">
                <span slot="icon">
                    <HoverIcon>
                        <Kebab size={$iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                </span>
                <span slot="menu">
                    <Menu>
                        <MenuItem
                            disabled={!canMarkAllRead}
                            on:click={() => dispatch("markAllRead")}>
                            <CheckboxMultipleMarked
                                size={$iconSize}
                                color={"var(--icon-inverted-txt)"}
                                slot="icon" />
                            <span slot="text"
                                ><Translatable resourceKey={i18nKey("markAllRead")} /></span>
                        </MenuItem>
                        <MenuItem on:click={() => activityFeedShowing.set(false)}>
                            <Close
                                size={$iconSize}
                                color={"var(--icon-inverted-txt)"}
                                slot="icon" />
                            <span slot="text"><Translatable resourceKey={i18nKey("close")} /></span>
                        </MenuItem>
                    </Menu>
                </span>
            </MenuIcon>
        </span>
    </div>
</SectionHeader>

<style lang="scss">
    .header {
        @include left_panel_header();
    }
</style>
