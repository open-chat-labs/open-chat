<script lang="ts">
    import ForumOutline from "svelte-material-icons/ForumOutline.svelte";
    import Plus from "svelte-material-icons/Plus.svelte";
    import { _ } from "svelte-i18n";
    import HoverIcon from "../../HoverIcon.svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();
</script>

<SectionHeader slim border={false}>
    <div class="group-chats">
        <div class="icon">
            <ForumOutline size={$iconSize} color={"var(--icon-txt)"} />
        </div>
        <div class="details">
            <h4 class="name">{$_("communities.groupChats")}</h4>
        </div>
    </div>
    <span class="menu" on:click={() => dispatch("newGroup")}>
        <HoverIcon>
            <Plus size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
</SectionHeader>

<style lang="scss">
    .group-chats {
        display: flex;
        flex: 1;
        align-items: center;
        gap: $sp4;

        @include mobile() {
            padding: 0 $sp3;
        }

        .icon {
            display: flex;
        }
    }
</style>
