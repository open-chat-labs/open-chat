<script lang="ts">
    import type { ActorRefFrom } from "xstate";
    import Close from "svelte-material-icons/Close.svelte";
    import Camera from "svelte-material-icons/Camera.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import SectionHeader from "../SectionHeader.svelte";
    import { _ } from "svelte-i18n";
    import type { HomeMachine } from "../../fsm/home.machine";
    import Avatar from "../Avatar.svelte";
    import { AvatarSize, UserStatus } from "../../domain/user/user";
    import Input from "../Input.svelte";
    import Button from "../Button.svelte";
    import Checkbox from "../Checkbox.svelte";

    const MIN_LENGTH = 3;
    const MAX_LENGTH = 25;

    export let machine: ActorRefFrom<HomeMachine>;

    let groupName: string = "";
    let historyVisible: boolean = false;
    let isPublic: boolean = false;

    $: valid = groupName.length > MIN_LENGTH && groupName.length <= MAX_LENGTH;

    function cancel() {
        machine.send({ type: "CANCEL_NEW_GROUP" });
    }

    function createGroup() {
        alert("create group");
    }

    function addPhoto() {
        alert("add group photo");
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
    <div class="photo-section sub-section" on:click={addPhoto}>
        <div class="photo-icon">
            <Camera size={"3em"} color={"#aaa"} />
        </div>
        <p>{$_("addGroupPhoto")}</p>
    </div>

    <Input
        invalid={false}
        autofocus={true}
        bind:value={groupName}
        minlength={MIN_LENGTH}
        maxlength={MAX_LENGTH}
        placeholder={$_("newGroupName")} />

    <div class="sub-section">
        <div class="scope">
            <span class="scope-label" class:selected={!isPublic} on:click={() => (isPublic = false)}
                >{$_("private")}</span>

            <Checkbox
                id="is-public"
                toggle={true}
                on:change={() => (isPublic = !isPublic)}
                label={$_("isPublic")}
                checked={isPublic} />

            <span class="scope-label" class:selected={isPublic} on:click={() => (isPublic = true)}
                >{$_("public")}</span>
        </div>

        <div class="info">
            {#if isPublic}
                <p>
                    {$_("publicGroupInfo")}
                </p>
                <p>
                    {$_("publicGroupUnique")}
                </p>
            {:else}
                <p>
                    {$_("privateGroupInfo")}
                </p>
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
                <p>
                    {$_("historyOnInfo")}
                </p>
            {:else}
                <p>
                    {$_("historyOffInfo")}
                </p>
            {/if}
        </div>
    </div>

    <Button disabled={!valid}>{$_("submitNewGroup")}</Button>
</form>

<style type="text/scss">
    h4 {
        flex: 1;
        padding: 0 $sp4;
    }
    .close {
        flex: 0 0 30px;
    }

    .photo-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        cursor: pointer;
    }

    .photo-icon {
        border: 1px solid #ccc;
        border-radius: 50%;
        width: 90px;
        height: 90px;
        display: flex;
        justify-content: center;
        align-items: center;
        margin-bottom: $sp4;
    }

    .group-form {
        flex: 1;
        padding: $sp4;
        background-color: var(--section-bg);
        color: var(--section-txt);

        @include size-below(xs) {
            padding: $sp3;
        }
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
        border-bottom: 3px solid transparent;

        &.selected {
            border-bottom: 3px solid var(--button-bg);
        }
    }

    .info {
        @include font(light, normal, fs-90);

        p {
            margin-bottom: $sp4;
        }
    }

    .history {
        margin-bottom: $sp4;
    }
</style>
