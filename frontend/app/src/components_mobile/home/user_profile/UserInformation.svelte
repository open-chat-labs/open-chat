<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import { BodySmall, CommonButton, Container, Form, TextArea } from "component-lib";
    import {
        allUsersStore,
        anonUserStore,
        currentUserIdStore,
        ErrorCode,
        OpenChat,
        suspendedUserStore,
        type PublicProfile,
    } from "openchat-client";
    import { getContext } from "svelte";
    import Save from "svelte-material-icons/ContentSaveOutline.svelte";
    import DisplayNameInput from "../../DisplayNameInput.svelte";
    import Translatable from "../../Translatable.svelte";
    import UsernameInput from "../../UsernameInput.svelte";
    import DiamondUpgradeBox from "../DiamondUpgradeBox.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import UserProfileImageEditor from "./UserProfileImageEditor.svelte";

    const MAX_DESC_LENGTH = 1024;
    const client = getContext<OpenChat>("client");

    interface Props {
        profile: PublicProfile;
    }

    let { profile }: Props = $props();
    let user = $derived($allUsersStore.get($currentUserIdStore) ?? client.nullUser("unknown"));
    let diamond = $derived(user?.diamondStatus !== "inactive");
    let candidate: PublicProfile = $state({ ...profile });
    let saving = $state(false);
    let usernameValid = $state(true);
    let displayNameValid = $state(true);
    let usernameError = $state<string>();
    let displayNameError = $state<string>();
    let bioError: string | undefined = $state(undefined);
    let readonly = $derived($suspendedUserStore || $anonUserStore);
    let bioDirty = $derived(candidate.bio !== profile.bio);
    let usernameDirty = $derived(candidate.username !== profile.username);
    let displayNameDirty = $derived(candidate.displayName !== profile.displayName);
    let buttonEnabled = $derived(
        usernameValid &&
            displayNameValid &&
            bioError === undefined &&
            (bioDirty || usernameDirty || displayNameDirty) &&
            !saving &&
            !readonly,
    );

    function saveUser(e: Event) {
        e.preventDefault();

        if ($anonUserStore) return;

        saving = true;
        bioError = undefined;
        const promises = [];

        if (bioDirty) {
            promises.push(
                client
                    .setBio(candidate.bio)
                    .then((resp) => {
                        if (resp.kind === "error" && resp.code === ErrorCode.TextTooLong) {
                            bioError = "register.bioTooLong";
                        } else {
                            bioError = undefined;
                            profile.bio = candidate.bio;
                        }
                    })
                    .catch((_) => {
                        toastStore.showFailureToast(i18nKey("unableToSaveUserProfile"));
                    }),
            );
        }

        if (usernameDirty) {
            promises.push(
                client
                    .setUsername(user.userId, candidate.username)
                    .then((resp) => {
                        if (resp !== "success") {
                            if (resp === "username_taken") {
                                usernameError = "register.usernameTaken";
                            } else if (resp === "user_not_found") {
                                usernameError = "register.userNotFound";
                            } else if (resp === "username_too_short") {
                                usernameError = "register.usernameTooShort";
                            } else if (resp === "username_too_long") {
                                usernameError = "register.usernameTooLong";
                            } else if (resp === "username_invalid") {
                                usernameError = "register.usernameInvalid";
                            }
                        } else {
                            usernameError = undefined;
                            profile.username = candidate.username;
                        }
                    })
                    .catch((err) => {
                        toastStore.showFailureToast(i18nKey("unableToSaveUserProfile"));
                        client.logError("Unable to save username: ", err);
                    }),
            );
        }

        if (displayNameDirty) {
            promises.push(
                client
                    .setDisplayName(user.userId, candidate.displayName)
                    .then((resp) => {
                        if (resp !== "success") {
                            if (resp === "user_not_found") {
                                displayNameError = "register.userNotFound";
                            } else if (resp === "display_name_too_short") {
                                displayNameError = "register.displayNameTooShort";
                            } else if (resp === "display_name_too_long") {
                                displayNameError = "register.displayNameTooLong";
                            } else if (resp === "display_name_invalid") {
                                displayNameError = "register.displayNameInvalid";
                            }
                        } else {
                            displayNameError = undefined;
                            profile.displayName = candidate.displayName;
                        }
                    })
                    .catch(() => {
                        toastStore.showFailureToast(i18nKey("unableToSaveUserProfile"));
                    }),
            );
        }

        Promise.all(promises).finally(() => (saving = false));
    }
</script>

<SlidingPageContent title={i18nKey("Edit profile")}>
    <Container
        padding={["zero", "lg", "lg", "lg"]}
        gap={"lg"}
        height={{ kind: "fill" }}
        crossAxisAlignment={"center"}
        direction={"vertical"}>
        <Container gap={"xl"} direction={"vertical"}>
            {#if !diamond}
                <DiamondUpgradeBox />
            {/if}

            <UserProfileImageEditor bind:profile={candidate} />

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
                        {client}
                        errorMsg={usernameError}
                        originalUsername={profile.username}
                        disabled={readonly}
                        bind:username={candidate.username}
                        bind:usernameValid>
                    </UsernameInput>
                    <DisplayNameInput
                        {client}
                        errorMsg={displayNameError}
                        originalDisplayName={profile.displayName}
                        disabled={readonly}
                        bind:displayName={candidate.displayName}
                        bind:displayNameValid>
                    </DisplayNameInput>
                    <TextArea
                        maxlength={MAX_DESC_LENGTH}
                        countdown
                        rows={5}
                        id={"user_bio"}
                        bind:value={candidate.bio}
                        placeholder={"Bio"}>
                        {#snippet subtext()}
                            <Translatable
                                resourceKey={i18nKey(
                                    bioError ?? "Optionally tell us a bit more about yourself",
                                )}></Translatable>
                        {/snippet}
                    </TextArea>

                    <Container mainAxisAlignment={"end"} gap={"sm"} crossAxisAlignment={"end"}>
                        <CommonButton
                            disabled={!buttonEnabled}
                            onClick={saveUser}
                            loading={saving}
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
