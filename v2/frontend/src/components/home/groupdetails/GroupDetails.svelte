<script lang="ts">
    import type { ActorRefFrom } from "xstate";
    import GroupDetailsHeader from "./GroupDetailsHeader.svelte";
    import EditableAvatar from "../../EditableAvatar.svelte";
    import Input from "../../Input.svelte";
    import TextArea from "../../TextArea.svelte";
    import type { EditGroupMachine } from "../../../fsm/editgroup.machine";
    import { _ } from "svelte-i18n";

    export let machine: ActorRefFrom<EditGroupMachine>;

    const MIN_LENGTH = 3;
    const MAX_LENGTH = 25;
    const MAX_DESC_LENGTH = 1024;
    let groupAvatar: string | undefined = undefined;
    let groupName: string = $machine.context.chatSummary.name;
    let groupDesc: string = $machine.context.chatSummary.description;

    $: isPublic =
        $machine.context.chatSummary.kind === "group_chat" && $machine.context.chatSummary.public;

    function close() {
        machine.send({ type: "HIDE_PARTICIPANTS" });
    }

    function groupAvatarSelected(ev: CustomEvent<string>) {
        groupAvatar = ev.detail;
    }
</script>

<GroupDetailsHeader on:close={close} />

<form class="group-form">
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
            bind:value={groupDesc}
            invalid={false}
            maxlength={MAX_DESC_LENGTH}
            placeholder={$_("newGroupDesc")} />
    </div>
    <!-- <div class="cta">
        <Button
            fill={true}
            disabled={!valid || $machine.matches({ canister_creation: "creating" })}
            loading={$machine.matches({ canister_creation: "creating" })}
            >{$_("submitNewGroup")}</Button>
    </div> -->
</form>

<style type="text/scss">
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
</style>
