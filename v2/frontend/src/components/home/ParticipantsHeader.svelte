<script lang="ts">
    import HoverIcon from "../HoverIcon.svelte";
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

<div class="participants-header">
    <span title={$_("addParticipant")} class="add" on:click={addParticipant}>
        <HoverIcon>
            <AccountPlusOutline size={"1.2em"} color={"#aaa"} />
        </HoverIcon>
    </span>
    <h4>Participants</h4>
    <span title={$_("close")} class="close" on:click={close}>
        <HoverIcon>
            <Close size={"1.2em"} color={"#aaa"} />
        </HoverIcon>
    </span>
</div>

<style type="text/scss">
    h4 {
        flex: 1;
        margin: 0;
        text-align: center;
    }
    .participants-header {
        display: flex;
        position: sticky;
        top: 0;
        align-items: center;
        width: 100%;
        padding: 10px;
        height: 65px;
        background-color: var(--participants-header-bg);
        border: 1px solid var(--participants-header-bd);
        color: var(--participants-header-txt);
        margin-bottom: 10px;
        @include z-index("participants-header");
        @include box-shadow(1);
        cursor: pointer;
    }
    .close,
    .add {
        flex: 0 0 30px;
    }
</style>
