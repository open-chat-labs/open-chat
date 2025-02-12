<script lang="ts">
    import Kebab from "svelte-material-icons/DotsVertical.svelte";
    import CheckboxMultipleMarked from "svelte-material-icons/CheckboxMultipleMarked.svelte";
    import HeartOutline from "svelte-material-icons/HeartOutline.svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import MenuIcon from "../../MenuIconLegacy.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Menu from "../../Menu.svelte";
    import MenuItem from "../../MenuItemLegacy.svelte";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    export let canMarkAllRead: boolean;
</script>

<SectionHeader slim border={false}>
    <div class="favourites">
        <div class="icon">
            <HeartOutline size={$iconSize} color={"var(--icon-txt)"} />
        </div>
        <div class="details">
            <h4 class="name"><Translatable resourceKey={i18nKey("communities.favourites")} /></h4>
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
                            onclick={() => dispatch("markAllRead")}>
                            <CheckboxMultipleMarked
                                size={$iconSize}
                                color={"var(--icon-inverted-txt)"}
                                slot="icon" />
                            <span slot="text"
                                ><Translatable resourceKey={i18nKey("markAllRead")} /></span>
                        </MenuItem>
                    </Menu>
                </span>
            </MenuIcon>
        </span>
    </div>
</SectionHeader>

<style lang="scss">
    .favourites {
        @include left_panel_header();
    }
</style>
