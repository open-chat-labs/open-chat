<script lang="ts">
    import type { ActorRefFrom } from "xstate";
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import SectionHeader from "../SectionHeader.svelte";
    import { _ } from "svelte-i18n";
    import Avatar from "../Avatar.svelte";
    import EditableAvatar from "../EditableAvatar.svelte";
    import { AvatarSize, UserStatus } from "../../domain/user/user";
    import Input from "../Input.svelte";
    import TextArea from "../TextArea.svelte";
    import Button from "../Button.svelte";
    import Checkbox from "../Checkbox.svelte";
    import type { GroupMachine } from "../../fsm/group.machine";

    const MIN_LENGTH = 3;
    const MAX_LENGTH = 25;
    const MAX_DESC_LENGTH = 1024;

    export let machine: ActorRefFrom<GroupMachine>;

    let groupName: string = $machine.context.candidateGroup.name;
    let groupDesc: string = $machine.context.candidateGroup.description;
    let historyVisible: boolean = $machine.context.candidateGroup.historyVisible;
    let isPublic: boolean = $machine.context.candidateGroup.isPublic;
    let groupAvatar: string | undefined = $machine.context.candidateGroup.avatar;

    $: valid = groupName.length > MIN_LENGTH && groupName.length <= MAX_LENGTH;

    function cancel() {
        machine.send({ type: "CANCEL_NEW_GROUP" });
    }

    function chooseParticipants() {
        machine.send({
            type: "CHOOSE_PARTICIPANTS",
            data: {
                name: groupName,
                description: groupDesc,
                historyVisible,
                isPublic,
                participants: $machine.context.candidateGroup.participants,
                avatar: groupAvatar,
            },
        });
    }

    function toggleScope() {
        isPublic = !isPublic;
        if (isPublic) {
            historyVisible = true;
        }
    }

    function groupAvatarSelected(ev: CustomEvent<string>) {
        groupAvatar = ev.detail;
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

<form class="group-form" on:submit|preventDefault={chooseParticipants}>
    <div class="form-fields">
        <div class="sub-section photo">
            <EditableAvatar image={groupAvatar} on:imageSelected={groupAvatarSelected} />
            <p class="photo-legend">{$_("addGroupPhoto")}</p>
        </div>

        <Input
            invalid={false}
            autofocus={false}
            bind:value={groupName}
            minlength={MIN_LENGTH}
            maxlength={MAX_LENGTH}
            countdown={true}
            placeholder={$_("newGroupName")} />

        <TextArea
            invalid={false}
            bind:value={groupDesc}
            maxlength={MAX_DESC_LENGTH}
            placeholder={$_("newGroupDesc")} />

        <div class="sub-section">
            <div class="scope">
                <span
                    class="scope-label"
                    class:selected={!isPublic}
                    on:click={() => (isPublic = false)}>{$_("private")}</span>

                <Checkbox
                    id="is-public"
                    toggle={true}
                    on:change={toggleScope}
                    label={$_("isPublic")}
                    checked={isPublic} />

                <span
                    class="scope-label"
                    class:selected={isPublic}
                    on:click={() => (isPublic = true)}>{$_("public")}</span>
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
                    disabled={isPublic}
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
    </div>
    <div class="cta">
        <Button
            fill={true}
            disabled={!valid || $machine.matches({ canister_creation: "creating" })}
            loading={$machine.matches({ canister_creation: "creating" })}
            >{$_("submitNewGroup")}</Button>
    </div>
</form>

<style type="text/scss">
    h4 {
        flex: 1;
        padding: 0 $sp4;
    }
    .close {
        flex: 0 0 30px;
    }

    .cta {
        position: sticky;
        bottom: 0;
        height: 57px;
    }

    .photo {
        text-align: center;
    }

    .photo-legend {
        margin-top: $sp4;
    }

    .group-form {
        flex: 1;
        background-color: var(--section-bg);
        color: var(--section-txt);
        overflow: auto;
        @include size-below(xs) {
            background-color: transparent;
        }
    }

    .form-fields {
        padding: $sp4;
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
