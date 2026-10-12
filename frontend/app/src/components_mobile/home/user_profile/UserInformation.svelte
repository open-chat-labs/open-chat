<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import { BodySmall, CommonButton, Container, Form, TextArea } from "component-lib";
    import {
        allUsersStore,
        anonUserStore,
        currentUserIdStore,
        MAX_BIO_LENGTH,
        OpenChat,
        profileChanges,
        suspendedUserStore,
        type ProfileFieldErrors,
        type PublicProfile,
    } from "@client";
    import { getContext } from "svelte";
    import Save from "svelte-material-icons/ContentSaveOutline.svelte";
    import DisplayNameInput from "../../DisplayNameInput.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import UsernameInput from "../../UsernameInput.svelte";
    import DiamondUpgradeBox from "../DiamondUpgradeBox.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import UserProfileImageEditor from "./UserProfileImageEditor.svelte";

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
    let errors = $state<ProfileFieldErrors>({});
    let readonly = $derived($suspendedUserStore || $anonUserStore);
    let changes = $derived(profileChanges(profile, candidate));
    let buttonEnabled = $derived(
        usernameValid &&
            displayNameValid &&
            (changes.username || changes.displayName || changes.bio) &&
            !saving &&
            !readonly,
    );

    async function saveUser(e: Event) {
        e.preventDefault();
        saving = true;
        try {
            const outcome = await client.saveProfile(profile, candidate);
            Object.assign(profile, outcome.profile);
            errors = outcome.errors;
            if (outcome.failure !== undefined) {
                toastStore.showFailureToast(outcome.failure);
            }
        } finally {
            saving = false;
        }
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
                        errorMsg={errors.username}
                        originalUsername={profile.username}
                        disabled={readonly}
                        bind:username={candidate.username}
                        bind:usernameValid>
                    </UsernameInput>
                    <DisplayNameInput
                        {client}
                        errorMsg={errors.displayName}
                        originalDisplayName={profile.displayName}
                        disabled={readonly}
                        bind:displayName={candidate.displayName}
                        bind:displayNameValid>
                    </DisplayNameInput>
                    <TextArea
                        maxlength={MAX_BIO_LENGTH}
                        countdown
                        rows={5}
                        id={"user_bio"}
                        bind:value={candidate.bio}
                        placeholder={"Bio"}>
                        {#snippet subtext()}
                            <Translatable
                                resourceKey={i18nKey(
                                    errors.bio ?? "Optionally tell us a bit more about yourself",
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
