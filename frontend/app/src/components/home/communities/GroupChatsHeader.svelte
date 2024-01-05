<script lang="ts">
    import ForumOutline from "svelte-material-icons/ForumOutline.svelte";
    import { _ } from "svelte-i18n";
    import SectionHeader from "../../SectionHeader.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import GroupChatsMenu from "./GroupChatsMenu.svelte";
    import Translatable from "../../Translatable.svelte";
</script>

<SectionHeader slim border={false}>
    <div class="group-chats">
        <div class="icon">
            <ForumOutline size={$iconSize} color={"var(--icon-txt)"} />
        </div>
        <div class="details">
            <h4 class="name">
                <Translatable key={"communities.groupChats"} />
            </h4>
        </div>
    </div>
    <span class="menu">
        <GroupChatsMenu on:newGroup />
    </span>
</SectionHeader>

<style lang="scss">
    .group-chats {
        @include left_panel_header();
    }
</style>
