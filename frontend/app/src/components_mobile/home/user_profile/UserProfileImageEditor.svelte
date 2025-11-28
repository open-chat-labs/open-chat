<script lang="ts">
    import { toastStore } from "@src/stores/toast";
    import { Container, IconButton } from "component-lib";
    import {
        allUsersStore,
        currentUserIdStore,
        i18nKey,
        OpenChat,
        type PublicProfile,
    } from "openchat-client";
    import { getContext } from "svelte";
    import ImageEditOutline from "svelte-material-icons/ImageEditOutline.svelte";
    import EditableAvatar from "../../EditableAvatar.svelte";
    import EditableImageWrapper from "../../EditableImageWrapper.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        profile: PublicProfile;
    }

    let { profile = $bindable() }: Props = $props();

    let user = $derived($allUsersStore.get($currentUserIdStore) ?? client.nullUser("unknown"));

    let backgroundUrl = $derived(
        client.buildUserBackgroundUrl(
            import.meta.env.OC_BLOB_URL_PATTERN!,
            user.userId,
            profile.backgroundId,
        ),
    );

    let avatarUrl = $derived(
        client.buildUserAvatarUrl(
            import.meta.env.OC_BLOB_URL_PATTERN!,
            user.userId,
            profile.avatarId,
        ),
    );

    const gradient =
        "linear-gradient(90deg, var(--warning) 0%, var(--primary) 30%, var(--primary) 70%, var(--tertiary) 100%)";

    function userAvatarSelected(detail: { url: string; data: Uint8Array }): void {
        client.setUserAvatar(detail.data, detail.url).then((blobId) => {
            if (blobId !== undefined) {
                profile.avatarId = blobId;
            } else {
                toastStore.showFailureToast(i18nKey("avatarUpdateFailed"));
            }
        });
        avatarUrl = detail.url;
    }

    function onBackgroundImageSelected(args: { url: string; data: Uint8Array }) {
        client.setUserProfileBackground(args.data).then((blobId) => {
            if (blobId !== undefined) {
                profile.backgroundId = blobId;
            } else {
                toastStore.showFailureToast(i18nKey("avatarUpdateFailed"));
            }
        });
        backgroundUrl = args.url;
    }
</script>

<EditableImageWrapper
    classString={"user_profile_background"}
    image={backgroundUrl}
    onImageSelected={onBackgroundImageSelected}
    mode={"profile"}>
    {#snippet children(choosePhoto: () => void)}
        <Container direction={"vertical"}>
            <Container
                borderRadius={"md"}
                minHeight={"10rem"}
                mainAxisAlignment={"end"}
                padding={"sm"}
                gap={"xs"}
                backgroundImage={backgroundUrl}
                background={gradient}>
                <IconButton onclick={choosePhoto} size={"md"} mode={"dark"}>
                    {#snippet icon(color)}
                        <ImageEditOutline {color} />
                    {/snippet}
                </IconButton>
            </Container>
            <Container
                supplementalClass={"user_profile_editable_avatar"}
                gap={"lg"}
                crossAxisAlignment={"center"}
                padding={["zero", "lg"]}
                direction="vertical">
                <EditableAvatar
                    onImageSelected={userAvatarSelected}
                    image={avatarUrl}
                    size={"large"} />
            </Container>
        </Container>
    {/snippet}
</EditableImageWrapper>

<style lang="scss">
    :global(.container.user_profile_editable_avatar) {
        margin-top: -7rem;
    }

    :global(.editable-image.user_profile_background) {
        width: 100%;
    }
</style>
