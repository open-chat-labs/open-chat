<script lang="ts">
    import CanisterMapFrame from "@shared_components/CanisterMapFrame.svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import SlidingPageContent from "../SlidingPageContent.svelte";
</script>

<SlidingPageContent title={i18nKey("Architecture")}>
    <div class="frame">
        <CanisterMapFrame />
    </div>
</SlidingPageContent>

<style lang="scss">
    // Takes the rest of the sliding page below its header
    .frame {
        flex: 1 1 auto;
        min-height: 0;
        align-self: stretch;
    }
</style>
