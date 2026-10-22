<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import { BodySmall, CommonButton, Container, Form, TextArea } from "component-lib";
    import {
        allUsersStore,
        anonUserStore,
        currentUserProfileStore,
        currentUserIdStore,
        MAX_BIO_LENGTH,
        OpenChat,
        suspendedUserStore,
    } from "@client";
    import { ProfileForm } from "@src/logic/profile/profileForm.svelte";
    import { getContext, onDestroy } from "svelte";
    import Save from "svelte-material-icons/ContentSaveOutline.svelte";
    import DisplayNameInput from "../../DisplayNameInput.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import UsernameInput from "../../UsernameInput.svelte";
    import DiamondUpgradeBox from "../DiamondUpgradeBox.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import UserProfileImageEditor from "./UserProfileImageEditor.svelte";

    const client = getContext<OpenChat>("client");

    let user = $derived($allUsersStore.get($currentUserIdStore) ?? client.nullUser("unknown"));
    let diamond = $derived(user?.diamondStatus !== "inactive");
    let readonly = $derived($suspendedUserStore || $anonUserStore);
    // username, display name and bio (app/src/logic/profile), saved as the client keeps them
    const form = new ProfileForm(
        client,
        () => $currentUserProfileStore,
        () => readonly,
    );
    onDestroy(() => form.destroy());

    async function saveUser(e: Event) {
        e.preventDefault();
        const outcome = await form.save();
        if (outcome.kind === "failed") toastStore.showFailureToast(outcome.reason);
    }
</script>

<SlidingPageContent title={i18nKey("Edit profile")}>
    <Container
        padding={["xxl", "lg"]}
        gap={"lg"}
        height={"fill"}
        crossAxisAlignment={"center"}
        direction={"vertical"}>
        <Container gap={"xl"} direction={"vertical"}>
            {#if !diamond}
                <DiamondUpgradeBox />
            {/if}

            <UserProfileImageEditor profile={form.candidate} />

            <Container padding={["zero", "lg"]}>
                <BodySmall fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Profile data")}></Translatable>
                </BodySmall>
            </Container>
            <Form onSubmit={saveUser}>
                <Container
                    direction={"vertical"}
                    gap={"lg"}
                    supplementalClass={"user_profile_info"}>
                    <UsernameInput
                        check={form.username}
                        errorMsg={form.usernameError}
                        disabled={readonly}></UsernameInput>
                    <DisplayNameInput
                        errorMsg={form.errors.displayName}
                        originalDisplayName={$currentUserProfileStore.displayName}
                        disabled={readonly}
                        bind:displayName={
                            () => form.displayName, (name) => (form.displayName = name)
                        }></DisplayNameInput>
                    <TextArea
                        maxlength={MAX_BIO_LENGTH}
                        countdown
                        rows={5}
                        id={"user_bio"}
                        bind:value={() => form.bio, (bio) => (form.bio = bio)}
                        placeholder={"Bio"}>
                        {#snippet subtext()}
                            <Translatable
                                resourceKey={i18nKey(
                                    form.errors.bio ??
                                        "Optionally tell us a bit more about yourself",
                                )}></Translatable>
                        {/snippet}
                    </TextArea>

                    <Container mainAxisAlignment={"end"} gap={"sm"} crossAxisAlignment={"end"}>
                        <CommonButton
                            disabled={!form.canSave}
                            onClick={saveUser}
                            loading={form.saving}
                            size={"medium"}
                            mode={"active"}>
                            {#snippet icon(color, size)}
                                <Save {color} {size}></Save>
                            {/snippet}
                            <Translatable resourceKey={i18nKey("Save profile")}></Translatable>
                        </CommonButton>
                    </Container>
                </Container>
            </Form>
        </Container>
    </Container>
</SlidingPageContent>
