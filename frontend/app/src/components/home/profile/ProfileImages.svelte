<script lang="ts">
    import Avatar from "@src/components/Avatar.svelte";
    import EditableImage from "@src/components/EditableImage.svelte";
    import Verified from "@src/components/icons/Verified.svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import { AvatarSize, OpenChat, type UserSummary } from "openchat-client";
    import { getContext, onMount } from "svelte";
    const client = getContext<OpenChat>("client");
    interface Props {
        user: UserSummary;
        readonly: boolean;
    }
    let { user, readonly }: Props = $props();
    let backgroundImage = $state<string>();
    let verified = $derived(!user.isUniquePerson);
    function userAvatarSelected(detail: { url: string; data: Uint8Array }): void {
        client.setUserAvatar(detail.data, detail.url).then((success) => {
            if (!success) {
                toastStore.showFailureToast(i18nKey("avatarUpdateFailed"));
            }
        });
    }
    function userBackgroundSelected(detail: { url: string; data: Uint8Array }): void {
        client.setUserProfileBackground(detail.data, detail.url).then((success) => {
            if (!success) {
                toastStore.showFailureToast(i18nKey("avatarUpdateFailed"));
            }
        });
    }
    onMount(() => {
        client.getProfileBackgroundImage().then((bg) => {
            backgroundImage = bg;
        });
    });
</script>

<div class="wrapper">
    {#if readonly}
        <Avatar url={client.userAvatarUrl(user)} userId={user.userId} size={AvatarSize.Large} />
    {:else}
        <!-- <div class="banner">
            <EditableImage
                mode={"profile"}
                overlayIcon
                image={backgroundImage}
                onImageSelected={userBackgroundSelected} />
        </div> -->
        <div class="avatar">
            <EditableImage
                mode={"avatar"}
                overlayIcon
                size={"medium"}
                image={client.userAvatarUrl(user)}
                onImageSelected={userAvatarSelected} />
            <div class="human">
                <Verified size={"large"} {verified} tooltip={i18nKey("human.verified")} />
            </div>
        </div>
    {/if}
</div>

<style lang="scss">
    .wrapper {
        position: relative;
        background-size: cover;
        background-position: center;
        background-repeat: no-repeat;
        margin-bottom: toRem(48);
    }

    .avatar {
        position: absolute;
        bottom: toRem(-32);
        left: toRem(18);
        border-radius: var(--avatar-rd);
        border: 2px solid var(--txt-light);

        .human {
            position: absolute;
            bottom: 0;
            left: calc(50% + 32px);
        }
    }
</style>
