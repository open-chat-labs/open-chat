<script lang="ts">
    import { i18nKey, interpolate } from "@src/i18n/i18n";
    import { createLocalStorageStore } from "@src/utils/store";
    import {
        BodySmall,
        Button,
        Container,
        Form,
        Input,
        Sheet,
        Subtitle,
        Switch,
    } from "component-lib";
    import EmailValidator from "email-validator";
    import type { CreatedUser, OpenChat, UserOrUserGroup, UserSummary } from "openchat-client";
    import { AuthProvider, identityStateStore, selectedAuthProviderStore } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import AlertBox from "../AlertBox.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import FindUser from "../FindUser.svelte";
    import TermsContent from "../TermsContent.svelte";
    import Translatable from "../Translatable.svelte";
    import UsernameInput from "../UsernameInput.svelte";
    import UserPill from "../UserPill.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        onCreatedUser: (user: CreatedUser) => void;
        error: string | undefined;
    }

    let { error = $bindable(), onCreatedUser }: Props = $props();

    let showGuidelines = $state(false);
    let username = $state("");
    let usernameValid = $state(false);
    let usernameStore = createLocalStorageStore("openchat_candidate_username", "");
    let checkingUsername: boolean = $state(false);
    let email = $state("");
    let emailValid = $derived(email.length === 0 || EmailValidator.validate(email));
    let busy = $state(false);
    let badCode = $state(false);
    let referringUser: UserSummary | undefined = $state(undefined);
    let createdUser: CreatedUser | undefined = undefined;
    let passkeyCreated = $state(false);
    let termsAccepted = $state(false);

    function onShowGuidelines() {
        showGuidelines = true;
        client.gaTrack("show_guidelines_clicked", "registration");
    }
    function onCloseGuidelines() {
        showGuidelines = false;
    }

    async function register(e: Event) {
        e.preventDefault();
        if (usernameValid && emailValid) {
            usernameStore.set(username);
            try {
                busy = true;
                selectedAuthProviderStore.set(AuthProvider.PASSKEY);

                // if we are already in the registering state it means that we are somehow
                // already signed in, but there is no user. In that case, skip the webauthn
                // and just call registerUser
                if ($identityStateStore.kind !== "registering") {
                    if (!passkeyCreated) {
                        if (client.isNativeAndroid()) {
                            await client.signUpWithAndroidWebAuthn(true, username);
                        } else {
                            await client.signUpWithWebAuthn(true, username);
                        }
                    }
                }
                passkeyCreated = true;
                await registerUser(username, email.length > 0 ? email : undefined);
            } catch (err) {
                error = `Error registering user: ${JSON.stringify(err)}`;
            } finally {
                busy = false;
            }
        }
    }

    async function registerUser(username: string, email: string | undefined) {
        await client.registerUser(username, email).then((resp) => {
            badCode = false;
            if (resp.kind === "username_taken") {
                error = "register.usernameTaken";
            } else if (resp.kind === "username_too_short") {
                error = "register.usernameTooShort";
            } else if (resp.kind === "username_too_long") {
                error = "register.usernameTooLong";
            } else if (resp.kind === "username_invalid") {
                error = "register.usernameInvalid";
            } else if (resp.kind === "email_invalid") {
                error = "register.emailInvalid";
            } else if (resp.kind === "user_limit_reached") {
                error = "register.userLimitReached";
            } else if (resp.kind === "internal_error") {
                error = "unexpectedError";
            } else if (resp.kind === "referral_code_invalid") {
                error = "register.referralCodeInvalid";
                badCode = true;
            } else if (resp.kind === "referral_code_already_claimed") {
                error = "register.referralCodeAlreadyClaimed";
                badCode = true;
            } else if (resp.kind === "referral_code_expired") {
                error = "register.referralCodeExpired";
                badCode = true;
            } else if (resp.kind === "success") {
                // error = undefined;
                createdUser = {
                    kind: "created_user",
                    username,
                    dateCreated: BigInt(Date.now()),
                    displayName: undefined,
                    cryptoAccount: resp.icpAccount,
                    userId: resp.userId,
                    isPlatformModerator: false,
                    isPlatformOperator: false,
                    suspensionDetails: undefined,
                    isSuspectedBot: false,
                    diamondStatus: { kind: "inactive" },
                    moderationFlagsEnabled: 0,
                    updated: 0n,
                    isBot: false,
                    isUniquePerson: false,
                    totalChitEarned: 0,
                    chitBalance: 0,
                    streak: 0,
                    maxStreak: 0,
                };
                onCreatedUser(createdUser);
                busy = false;
                usernameStore.set("");
            } else {
                error = `Unexpected register user response: ${resp.kind}`;
            }
        });
    }

    function deleteUser(_: UserOrUserGroup) {
        referringUser = undefined;
        client.clearReferralCode();
    }

    function selectUser(user: UserSummary) {
        referringUser = user;
        client.setReferralCode(user.userId);
    }

    function userLookup(searchTerm: string): Promise<[UserSummary[], UserSummary[]]> {
        return client.searchUsers(searchTerm, 20).then((res) => [[], res]);
    }

    // function clearCodeAndLogout() {
    //     client.clearReferralCode();
    //     client.logout();
    // }

    onMount(async () => {
        referringUser = await client.getReferringUser();
    });
</script>

{#if showGuidelines}
    <Sheet onDismiss={onCloseGuidelines}>
        <Container gap={"lg"} direction={"vertical"} padding={"xl"}>
            <Subtitle>OpenChat Terms</Subtitle>
            <TermsContent />
            <Button onClick={onCloseGuidelines}>
                <Translatable resourceKey={i18nKey("register.agree")} />
            </Button>
        </Container>
    </Sheet>
{/if}

<Container padding={["md", "zero", "xxl", "zero"]}>
    {#if badCode}
        <AlertBox>
            <h4 class="main">
                <Translatable resourceKey={i18nKey("register.referralCodeInvalid")} />
            </h4>
            <p class="sub">
                <Translatable resourceKey={i18nKey("register.doYouWantToProceed")} />
            </p>
        </AlertBox>
    {:else}
        <Form onSubmit={register}>
            <Container gap={"xl"} direction={"vertical"}>
                <UsernameInput
                    {client}
                    disabled={busy}
                    originalUsername={$usernameStore ?? ""}
                    bind:username
                    bind:usernameValid
                    bind:errorMsg={error} />

                <Input
                    error={!emailValid}
                    disabled={busy}
                    placeholder={interpolate($_, i18nKey("register.emailPlaceholder"))}
                    bind:value={email}
                    minlength={0}
                    maxlength={254}>
                    {#snippet subtext()}
                        <Translatable resourceKey={i18nKey("register.emailRules")} />
                    {/snippet}
                </Input>

                {#if referringUser !== undefined}
                    <UserPill onDeleteUser={deleteUser} userOrGroup={referringUser} />
                {:else}
                    <FindUser
                        placeholderKey={"register.findReferrer"}
                        {userLookup}
                        onSelectUser={selectUser} />
                {/if}

                {#if error !== undefined}
                    <ErrorMessage><Translatable resourceKey={i18nKey(error)} /></ErrorMessage>
                {/if}
            </Container>
        </Form>
    {/if}
</Container>

<Container direction={"vertical"} gap={"lg"} padding={["zero", "md"]}>
    <Container onClick={onShowGuidelines}>
        <Switch reverse bind:checked={termsAccepted}>
            <BodySmall onClick={onShowGuidelines}>
                <Translatable resourceKey={i18nKey("I agree to the OpenChat terms & conditions")} />
            </BodySmall>
        </Switch>
    </Container>
    <Button
        width={"fill"}
        disabled={!termsAccepted || !usernameValid || !emailValid || busy}
        loading={checkingUsername || busy}
        onClick={register}>
        <Translatable resourceKey={i18nKey("Start my journey")} />
    </Button>
</Container>
