<script lang="ts">
    import { iconSize } from "openchat-client";
    import ForumOutline from "svelte-material-icons/ForumOutline.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import SectionHeader from "../../SectionHeader.svelte";
    import Translatable from "../../Translatable.svelte";
    import GroupChatsMenu from "./GroupChatsMenu.svelte";

    interface Props {
        canMarkAllRead: boolean;
    }

    let props: Props = $props();
</script>

<SectionHeader slim border={false}>
    <div class="favourites">
        <div class="icon">
            <ForumOutline size={$iconSize} color={"var(--icon-txt)"} />
        </div>
        <div class="details">
            <h4 class="name">
                <Translatable resourceKey={i18nKey("communities.directAndGroupChats")} />
            </h4>
        </div>
        <span class="menu">
            <GroupChatsMenu {...props} />
        </span>
    </div>
</SectionHeader>

<style lang="scss">
    .favourites {
        @include left_panel_header();
    }
</style>
