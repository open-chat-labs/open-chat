<script lang="ts">
    import { app, iconSize, mobileWidth } from "openchat-client";
    import { _ } from "svelte-i18n";
    import Close from "svelte-material-icons/Close.svelte";
    import { i18nKey, supportedLanguages } from "../../../../i18n/i18n";
    import Checkbox from "../../../Checkbox.svelte";
    import CollapsibleCard from "../../../CollapsibleCard.svelte";
    import HoverIcon from "../../../HoverIcon.svelte";
    import SectionHeader from "../../../SectionHeader.svelte";
    import Translatable from "../../../Translatable.svelte";

    interface Props {
        onClose: () => void;
    }

    let { onClose }: Props = $props();
</script>

<SectionHeader shadow flush={$mobileWidth}>
    <h4><Translatable resourceKey={i18nKey("communities.filters")} /></h4>
    <span title={$_("close")} class="close" on:click={onClose}>
        <HoverIcon>
            <Close size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
</SectionHeader>

<div class="community-filters">
    <CollapsibleCard open headerText={i18nKey("communities.primaryLanguage")}>
        {#each supportedLanguages as lang}
            <div class="toggle">
                <Checkbox
                    id={`language_${lang.code}`}
                    onChange={() => app.toggleCommunityFilterLanguage(lang.code)}
                    label={i18nKey(lang.name)}
                    checked={app.communityFilters.languages.has(lang.code)} />
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
