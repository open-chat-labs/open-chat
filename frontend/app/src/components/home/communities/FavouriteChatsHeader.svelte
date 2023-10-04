<script lang="ts">
    import HeartOutline from "svelte-material-icons/HeartOutline.svelte";
    import { _ } from "svelte-i18n";
    import SectionHeader from "../../SectionHeader.svelte";
    import { iconSize } from "../../../stores/iconSize";
</script>

<SectionHeader slim border={false}>
    <div class="favourites">
        <div class="icon">
            <HeartOutline size={$iconSize} color={"var(--icon-txt)"} />
        </div>
        <div class="details">
            <h4 class="name">{$_("communities.favourites")}</h4>
        </div>
    </div>
</SectionHeader>

<style lang="scss">
    .favourites {
        @include left_panel_header();
    }
</style>
