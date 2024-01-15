<script lang="ts">
    import MessageOutline from "svelte-material-icons/MessageOutline.svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
</script>

<SectionHeader slim border={false}>
    <div class="direct-chats">
        <div class="icon">
            <MessageOutline size={$iconSize} color={"var(--icon-txt)"} />
        </div>
        <div class="details">
            <h4 class="name"><Translatable resourceKey={i18nKey("communities.directChats")} /></h4>
        </div>
    </div>
</SectionHeader>

<style lang="scss">
    .direct-chats {
        @include left_panel_header();
    }
</style>
