<script lang="ts">
    import type { ActorRefFrom } from "xstate";
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import SectionHeader from "../SectionHeader.svelte";
    export let machine: ActorRefFrom<HomeMachine>;
    import { _ } from "svelte-i18n";
    import type { HomeMachine } from "../../fsm/home.machine";
    import Input from "../Input.svelte";
    import Button from "../Button.svelte";

    const MIN_CODE_LENGTH = 10; // what should this be?
    const MAX_CODE_LENGTH = 32; // what should this be?

    let code = "";
    let busy = false;

    function joinGroup() {
        if (code.length > 10) {
            console.log("actually joing the group");
            busy = true;
        }
    }

    function cancelJoinGroup() {
        machine.send({ type: "CANCEL_JOIN_GROUP" });
    }
</script>

<SectionHeader>
    <span title={$_("close")} class="close" on:click={cancelJoinGroup}>
        <HoverIcon>
            <Close size={"1.2em"} color={"#aaa"} />
        </HoverIcon>
    </span>
    <h4>{$_("joinGroup")}</h4>
</SectionHeader>

<form on:submit|preventDefault>
    <Input
        disabled={busy}
        bind:value={code}
        autofocus={true}
        minlength={MIN_CODE_LENGTH}
        maxlength={MAX_CODE_LENGTH}
        placeholder={$_("enterInviteCode")} />
    <Button on:click={joinGroup} loading={busy}>{$_("submit")}</Button>
</form>

<style type="text/scss">
    h4 {
        flex: 1;
        padding: 0 $sp4;
    }
    .close {
        flex: 0 0 30px;
    }
</style>
