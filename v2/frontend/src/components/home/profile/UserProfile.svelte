<script lang="ts">
    import { avatarUrl } from "../../../domain/user/user.utils";
    import type { PartialUserSummary } from "../../../domain/user/user";
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import EditableAvatar from "../../EditableAvatar.svelte";
    import Input from "../../Input.svelte";
    import TextArea from "../../TextArea.svelte";
    import { _ } from "svelte-i18n";
    import { iconSize } from "../../../stores/iconSize";
    import { createEventDispatcher, onMount } from "svelte";

    const dispatch = createEventDispatcher();
    const MIN_LENGTH = 3;
    const MAX_LENGTH = 25;
    const MAX_DESC_LENGTH = 1024;

    export let user: PartialUserSummary;

    let username = "";

    onMount(() => {
        username = user?.username ?? "";
    });

    function saveUser() {}

    function userAvatarSelected(ev: CustomEvent<{ url: string; data: Uint8Array }>): void {}

    function closeProfile() {
        dispatch("closeProfile");
    }
</script>

<form class="user-form" on:submit|preventDefault={saveUser}>
    <div class="user">
        <EditableAvatar image={avatarUrl(user)} on:imageSelected={userAvatarSelected} />
        <h4 class="photo-legend">{$_("clickToUpdateAvatar")}</h4>
        <div class="close" on:click={closeProfile}>
            <HoverIcon>
                <Close size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        </div>

        <div class="username-rules">{$_("usernameRules")}</div>
        <Input
            invalid={false}
            bind:value={username}
            autofocus={false}
            minlength={MIN_LENGTH}
            maxlength={MAX_LENGTH}
            countdown={true}
            placeholder={$_("register.enterUsername")} />

        <TextArea
            rows={3}
            invalid={false}
            maxlength={MAX_DESC_LENGTH}
            placeholder={$_("enterBio")} />
    </div>

    <div class="accordion" />
</form>

<style type="text/scss">
    $vertical-gap: $sp4;

    .user {
        padding: $sp4;
        background-color: var(--currentUser-bg);
        margin-bottom: $sp3;
        position: relative;
    }

    .username-rules {
        @include font(light, normal, fs-60);
        margin-bottom: $sp2;
    }

    .photo-legend {
        @include font(mediumBold, normal, fs-100);
        color: var(--currentUser-txt);
        text-align: center;
        margin-top: $sp3;
        margin-bottom: $vertical-gap;
    }

    .close {
        position: absolute;
        top: $sp3;
        right: $sp3;
        width: 40px;
        height: 40px;
    }
</style>
