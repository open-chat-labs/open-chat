<script lang="ts">
    import HoverIcon from "../../HoverIcon.svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";
    import { iconSize } from "../../../stores/iconSize";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    const dispatch = createEventDispatcher();
    function close() {
        dispatch("close");
    }
</script>

<SectionHeader gap border={false}>
    <h4><Translatable resourceKey={i18nKey("videoCall.participants")} /></h4>
    <span title={$_("close")} class="close" on:click={close}>
        <HoverIcon>
            <Close size={$iconSize} color={"var(--icon-txt)"} />
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
