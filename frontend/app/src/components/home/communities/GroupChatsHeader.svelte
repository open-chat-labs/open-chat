<script lang="ts">
    import ForumOutline from "svelte-material-icons/ForumOutline.svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import GroupChatsMenu from "./GroupChatsMenu.svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";

    export let canMarkAllRead: boolean;
</script>

<SectionHeader slim border={false}>
    <div class="group-chats">
        <div class="icon">
            <ForumOutline size={$iconSize} color={"var(--icon-txt)"} />
        </div>
        <div class="details">
            <h4 class="name">
                <Translatable resourceKey={i18nKey("communities.groupChats")} />
            </h4>
        </div>
    </div>
    <span class="menu">
        <GroupChatsMenu {canMarkAllRead} on:markAllRead />
    </span>
</SectionHeader>

<style lang="scss">
    .group-chats {
        @include left_panel_header();
    }
</style>
