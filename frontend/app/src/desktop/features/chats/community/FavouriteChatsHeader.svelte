<script lang="ts">
    import { iconSize, OpenChat } from "@client";
    import { getContext } from "svelte";
    import CheckboxMultipleMarked from "svelte-material-icons/CheckboxMultipleMarked.svelte";
    import Kebab from "svelte-material-icons/DotsVertical.svelte";
    import HeartOutline from "svelte-material-icons/HeartOutline.svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import HoverIcon from "@src/ui/HoverIcon.svelte";
    import Menu from "@src/desktop/shared/Menu.svelte";
    import MenuIcon from "@src/desktop/shared/MenuIcon.svelte";
    import MenuItem from "@src/desktop/shared/MenuItem.svelte";
    import SectionHeader from "@src/desktop/shared/SectionHeader.svelte";
    import Translatable from "@src/ui/Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        canMarkAllRead: boolean;
    }

    let { canMarkAllRead }: Props = $props();
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
                {#snippet menuIcon()}
                    <HoverIcon>
                        <Kebab size={$iconSize} color={"var(--icon-txt)"} />
                    </HoverIcon>
                {/snippet}
                {#snippet menuItems()}
                    <Menu>
                        <MenuItem
                            disabled={!canMarkAllRead}
                            onclick={() => client.markAllReadForCurrentScope()}>
                            {#snippet icon()}
                                <CheckboxMultipleMarked
                                    size={$iconSize}
                                    color={"var(--icon-inverted-txt)"} />
                            {/snippet}
                            {#snippet text()}
                                <span><Translatable resourceKey={i18nKey("markAllRead")} /></span>
                            {/snippet}
                        </MenuItem>
                    </Menu>
                {/snippet}
            </MenuIcon>
        </span>
    </div>
</SectionHeader>

<style lang="scss">
    .favourites {
        @include left_panel_header();
    }
</style>
