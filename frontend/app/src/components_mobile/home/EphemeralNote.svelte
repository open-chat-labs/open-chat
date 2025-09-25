<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import InfoIcon from "../InfoIcon.svelte";
</script>

<div class="ephemeral">
    <InfoIcon position={"top"} align={"start"} color={"var(--timeline-txt)"}>
        <Translatable resourceKey={i18nKey("ephemeralInfo")}></Translatable>
    </InfoIcon>
    <Translatable resourceKey={i18nKey("ephemeral")}></Translatable>
</div>

<style lang="scss">
    .ephemeral {
        display: flex;
        gap: $sp1;
        align-items: center;
        @include font(light, normal, fs-70);
        color: var(--timeline-txt);
        margin-top: $sp2;
    }
</style>
