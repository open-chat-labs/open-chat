<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { _ } from "svelte-i18n";
    import Close from "svelte-material-icons/Close.svelte";
    import SectionHeader from "../../../SectionHeader.svelte";
    import HoverIcon from "../../../HoverIcon.svelte";
    import { iconSize } from "../../../../stores/iconSize";
    import Checkbox from "../../../Checkbox.svelte";
    import { mobileWidth } from "../../../../stores/screenDimensions";
    import { communityFiltersStore } from "../../../../stores/communityFilters";
    import CollapsibleCard from "../../../CollapsibleCard.svelte";
    import { supportedLanguages } from "../../../../i18n/i18n";

    const dispatch = createEventDispatcher();

    function close() {
        dispatch("close");
    }
</script>

<SectionHeader shadow flush={$mobileWidth}>
    <h4>{$_("communities.filters")}</h4>
    <span title={$_("close")} class="close" on:click={close}>
        <HoverIcon>
            <Close size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
</SectionHeader>

<div class="community-filters">
    <CollapsibleCard open headerText={$_("communities.primaryLanguage")}>
        {#each supportedLanguages as lang}
            <div class="toggle">
                <Checkbox
                    id={`language_${lang.code}`}
                    on:change={() => communityFiltersStore.toggleLanguage(lang.code)}
                    label={lang.name}
                    checked={$communityFiltersStore.languages.has(lang.code)} />
            </div>
        {/each}
    </CollapsibleCard>
</div>

<style lang="scss">
    h4 {
        flex: 1;
        margin: 0;
        @include font-size(fs-120);
    }
    .close {
        flex: 0 0 30px;
    }

    .toggle {
        margin-bottom: $sp4;
    }

    .community-filters {
        background-color: var(--bg);
        padding: 0 $sp4;
        padding-bottom: 0;
        @include nice-scrollbar();

        @include mobile() {
            height: 100%;
        }
    }
</style>
