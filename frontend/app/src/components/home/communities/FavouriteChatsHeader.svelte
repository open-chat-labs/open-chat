<script lang="ts">
    import HeartOutline from "svelte-material-icons/HeartOutline.svelte";
    import { _ } from "svelte-i18n";
    import SectionHeader from "../../SectionHeader.svelte";
    import { iconSize } from "../../../stores/iconSize";
</script>

<SectionHeader border={false}>
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
