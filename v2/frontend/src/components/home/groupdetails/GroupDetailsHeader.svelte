<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { _ } from "svelte-i18n";

    const dispatch = createEventDispatcher();
    function close() {
        dispatch("close");
    }
</script>

<SectionHeader>
    <h4>{$_("groupDetails")}</h4>
    <span title={$_("close")} class="close" on:click={close}>
        <HoverIcon>
            <Close size={"1.2em"} color={"#aaa"} />
        </HoverIcon>
    </span>
</SectionHeader>

<style type="text/scss">
    h4 {
        flex: 1;
        margin: 0;
        text-align: center;
    }
    .close {
        flex: 0 0 30px;
    }
</style>
