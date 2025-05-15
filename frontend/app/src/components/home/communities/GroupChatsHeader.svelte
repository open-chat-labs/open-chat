<script lang="ts">
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
        <GroupChatsMenu {...props} />
    </span>
</SectionHeader>

<style lang="scss">
    .group-chats {
        @include left_panel_header();
    }
</style>
