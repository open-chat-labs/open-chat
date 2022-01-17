<script lang="ts">
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import SectionHeader from "../../SectionHeader.svelte";
    import { _ } from "svelte-i18n";
    import Avatar from "../../Avatar.svelte";
    import EditableAvatar from "../../EditableAvatar.svelte";
    import { AvatarSize, UserStatus } from "../../../domain/user/user";
    import Input from "../../Input.svelte";
    import TextArea from "../../TextArea.svelte";
    import Button from "../../Button.svelte";
    import Checkbox from "../../Checkbox.svelte";
    import { avatarUrl } from "../../../domain/user/user.utils";
    import { createEventDispatcher } from "svelte";
    import type { CandidateGroupChat } from "../../../domain/chat/chat";
    import { iconSize } from "../../../stores/iconSize";

    const dispatch = createEventDispatcher();
    const MIN_LENGTH = 3;
    const MAX_LENGTH = 25;
    const MAX_DESC_LENGTH = 1024;

    export let candidateGroup: CandidateGroupChat;
    export let creatingCanister: boolean;

    $: valid = candidateGroup.name.length > MIN_LENGTH && candidateGroup.name.length <= MAX_LENGTH;

    function cancel() {
        dispatch("cancelNewGroup");
    }

    function createGroup() {
        dispatch("createGroup");
    }

    function toggleScope() {
        candidateGroup.isPublic = !candidateGroup.isPublic;
        if (candidateGroup.isPublic) {
            candidateGroup.historyVisible = true;
        }
    }

    function groupAvatarSelected(ev: CustomEvent<{ url: string; data: Uint8Array }>) {
        candidateGroup.avatar = {
            blobUrl: ev.detail.url,
            blobData: ev.detail.data,
        };
    }
</script>

<SectionHeader>
    <span title={$_("close")} class="close" on:click={cancel}>
        <HoverIcon>
            <Close size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
    <h4>{$_("createNewGroup")}</h4>
    <Avatar url={"assets/group.svg"} status={UserStatus.None} size={AvatarSize.Tiny} />
</SectionHeader>

<form class="group-form" on:submit|preventDefault={createGroup}>
    <div class="form-fields">
        <div class="sub-section photo">
            <EditableAvatar
                image={avatarUrl(candidateGroup.avatar, "../assets/group.svg")}
                on:imageSelected={groupAvatarSelected} />
            <p class="photo-legend">{$_("addGroupPhoto")}</p>
        </div>

        <Input
            invalid={false}
            autofocus={false}
            bind:value={candidateGroup.name}
            minlength={MIN_LENGTH}
            maxlength={MAX_LENGTH}
            countdown={true}
            placeholder={$_("newGroupName")} />

        <TextArea
            rows={3}
            invalid={false}
            bind:value={candidateGroup.description}
            maxlength={MAX_DESC_LENGTH}
            placeholder={$_("newGroupDesc")} />

        <div class="sub-section">
            <div class="scope">
                <span
                    class="scope-label"
                    class:selected={!candidateGroup.isPublic}
                    on:click={() => (candidateGroup.isPublic = false)}>{$_("private")}</span>

                <Checkbox
                    id="is-public"
                    toggle={true}
                    on:change={toggleScope}
                    label={$_("public")}
                    checked={candidateGroup.isPublic} />

                <span
                    class="scope-label"
                    class:selected={candidateGroup.isPublic}
                    on:click={() => (candidateGroup.isPublic = true)}>{$_("public")}</span>
            </div>

            <div class="info">
                {#if candidateGroup.isPublic}
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
                    disabled={candidateGroup.isPublic}
                    on:change={() =>
                        (candidateGroup.historyVisible = !candidateGroup.historyVisible)}
                    label={$_("historyVisible")}
                    checked={candidateGroup.historyVisible} />
            </div>
            <div class="info">
                {#if candidateGroup.historyVisible}
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
</form>
<div class="cta">
    <Button
        on:click={createGroup}
        fill={true}
        disabled={!valid || creatingCanister}
        loading={creatingCanister}>{$_("submitNewGroup")}</Button>
</div>

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
        color: var(--section-txt);
        overflow: auto;
        overflow-x: hidden;
        @include nice-scrollbar();
    }

    .form-fields {
        padding: var(--groupForm-add-pd);
        @include size-below(xs) {
            padding: $sp3;
            padding-top: $sp2;
        }
    }

    .sub-section {
        padding: $sp4;
        background-color: var(--sub-section-bg);
        margin-bottom: $sp4;
        @include box-shadow(1);
        @include size-below(xs) {
            margin-bottom: $sp3;
        }
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
