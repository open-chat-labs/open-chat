<script lang="ts">
    import { ui } from "openchat-client";
    import { _ } from "svelte-i18n";
    import Close from "svelte-material-icons/Close.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import HoverIcon from "../../HoverIcon.svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import Translatable from "../../Translatable.svelte";

    let { onClose }: { onClose: () => void } = $props();
</script>

<SectionHeader gap border={false}>
    <h4><Translatable resourceKey={i18nKey("videoCall.participants")} /></h4>
    <span title={$_("close")} class="close" onclick={onClose}>
        <HoverIcon>
            <Close size={ui.iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
</SectionHeader>

<style lang="scss">
    h4 {
        flex: 1;
        margin: 0;
        @include font-size(fs-120);
    }
    .close {
        flex: 0 0 30px;
    }
</style>
