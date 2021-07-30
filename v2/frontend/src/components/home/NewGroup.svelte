<script lang="ts">
    import type { ActorRefFrom } from "xstate";
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import SectionHeader from "../SectionHeader.svelte";
    import { _ } from "svelte-i18n";
    import type { HomeMachine } from "../../fsm/home.machine";
    import Avatar from "../Avatar.svelte";
    import { AvatarSize, UserStatus } from "../../domain/user/user";
    import Input from "../Input.svelte";
    import Button from "../Button.svelte";
    import Checkbox from "../Checkbox.svelte";

    export let machine: ActorRefFrom<HomeMachine>;

    let groupName: string = "";
    let historyVisible: boolean = false;
    let isPublic: boolean = false;

    function cancel() {
        machine.send({ type: "CANCEL_NEW_GROUP" });
    }

    function createGroup() {
        alert("create group");
    }
</script>

<SectionHeader>
    <span title={$_("close")} class="close" on:click={cancel}>
        <HoverIcon>
            <Close size={"1.2em"} color={"#aaa"} />
        </HoverIcon>
    </span>
    <h4>{$_("createNewGroup")}</h4>
    <Avatar url={"assets/group.svg"} status={UserStatus.None} size={AvatarSize.Tiny} />
</SectionHeader>

<form class="group-form" on:submit|preventDefault={createGroup}>
    <Input
        invalid={false}
        autofocus={true}
        bind:value={groupName}
        minlength={3}
        maxlength={25}
        placeholder={$_("newGroupName")} />

    <div class="sub-section">
        <div class="scope">
            <span class="scope-label" on:click={() => (isPublic = false)}>Private</span>

            <Checkbox
                id="is-public"
                toggle={true}
                on:change={() => (isPublic = !isPublic)}
                label={$_("isPublic")}
                checked={isPublic} />

            <span class="scope-label" on:click={() => (isPublic = true)}>Public</span>
        </div>

        <div class="info">
            {#if isPublic}
                {$_("publicGroupInfo")}
            {:else}
                {$_("privateGroupInfo")}
            {/if}
        </div>
    </div>

    <div class="sub-section">
        <div class="history">
            <Checkbox
                id="history-visible"
                on:change={() => (historyVisible = !historyVisible)}
                label={$_("historyVisible")}
                checked={historyVisible} />
        </div>
        <div class="info">
            {#if historyVisible}
                {$_("historyOnInfo")}
            {:else}
                {$_("historyOffInfo")}
            {/if}
        </div>
    </div>

    <Button>{$_("submitNewGroup")}</Button>
</form>

<style type="text/scss">
    h4 {
        flex: 1;
        padding: 0 $sp4;
    }
    .close {
        flex: 0 0 30px;
    }

    .group-form {
        flex: 1;
        padding: $sp4;
        background-color: var(--section-bg);
        color: var(--section-txt);
    }

    .sub-section {
        padding: $sp4;
        background-color: var(--sub-section-bg);
        margin-bottom: $sp4;
        @include box-shadow(1);
    }

    .scope {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: $sp4;
    }

    .scope-label {
        @include font(book, normal, fs-140);
        cursor: pointer;
    }

    .info {
        @include font(light, normal, fs-90);
        margin-bottom: $sp4;
    }

    .history {
        margin-bottom: $sp4;
    }
</style>
