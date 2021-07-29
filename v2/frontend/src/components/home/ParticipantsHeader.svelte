<script lang="ts">
    import HoverIcon from "../HoverIcon.svelte";
    import SectionHeader from "../SectionHeader.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import AccountPlusOutline from "svelte-material-icons/AccountPlusOutline.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();
    function close() {
        dispatch("close");
    }

    // todo - this is probably contingent on being an admin
    function addParticipant() {
        dispatch("addParticipant");
    }
</script>

<SectionHeader>
    <span title={$_("addParticipant")} class="add" on:click={addParticipant}>
        <HoverIcon>
            <AccountPlusOutline size={"1.2em"} color={"#aaa"} />
        </HoverIcon>
    </span>
    <h4>{$_("participants")}</h4>
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
    .close,
    .add {
        flex: 0 0 30px;
    }
</style>
