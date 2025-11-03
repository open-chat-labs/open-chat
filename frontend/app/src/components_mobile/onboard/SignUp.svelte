<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { createLocalStorageStore } from "@src/utils/store";
    import { CommonButton, Container } from "component-lib";
    import type { CreatedUser, OpenChat, UserOrUserGroup, UserSummary } from "openchat-client";
    import {
        AuthProvider,
        identityStateStore,
        mobileWidth,
        selectedAuthProviderStore,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import AlertBox from "../AlertBox.svelte";
    import Button from "../Button.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import FindUser from "../FindUser.svelte";
    import TermsContent from "../landingpages/TermsContent.svelte";
    import Legend from "../Legend.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";
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
    let busy = $state(false);
    let badCode = $state(false);
    let referringUser: UserSummary | undefined = $state(undefined);
    let createdUser: CreatedUser | undefined = undefined;
    let passkeyCreated = $state(false);

    function onShowGuidelines() {
        showGuidelines = true;
        client.gaTrack("show_guidelines_clicked", "registration");
    }
    function onCloseGuidelines() {
        showGuidelines = false;
    }

    async function register(e: Event) {
        e.preventDefault();
        if (usernameValid) {
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
                await registerUser(username);
            } catch (err) {
                error = `Error registering user: ${err}`;
            } finally {
                busy = false;
            }
        }
    }

    async function registerUser(username: string) {
        await client.registerUser(username).then((resp) => {
            badCode = false;
            if (resp.kind === "username_taken") {
                error = "register.usernameTaken";
            } else if (resp.kind === "username_too_short") {
                error = "register.usernameTooShort";
            } else if (resp.kind === "username_too_long") {
                error = "register.usernameTooLong";
            } else if (resp.kind === "username_invalid") {
                error = "register.usernameInvalid";
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
                error = undefined;
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

    function clearCodeAndLogout() {
        client.clearReferralCode();
        client.logout();
    }

    onMount(async () => {
        referringUser = await client.getReferringUser();
    });
</script>

{#if showGuidelines}
    <Overlay onClose={onCloseGuidelines} dismissible={false}>
        <ModalContent large onClose={onCloseGuidelines}>
            {#snippet header()}
                <span class="header">
                    <h1>OpenChat Terms</h1>
                </span>
            {/snippet}
            {#snippet body()}
                <span class="guidelines-modal">
                    <TermsContent />
                </span>
            {/snippet}
            {#snippet footer(onClose)}
                <span>
                    <Button onClick={() => onClose?.()} small={!$mobileWidth} tiny={$mobileWidth}>
                        <Translatable resourceKey={i18nKey("register.agree")} />
                    </Button>
                </span>
            {/snippet}
        </ModalContent>
    </Overlay>
{/if}

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
    <form class="username-wrapper" onsubmit={register}>
        <div class="form-element">
            <Legend label={i18nKey("username")} rules={i18nKey("usernameRules")} />
            <UsernameInput
                {client}
                disabled={busy}
                originalUsername={$usernameStore ?? ""}
                bind:username
                bind:usernameValid
                bind:errorMsg={error} />
        </div>

        <div class="form-element">
            {#if referringUser !== undefined}
                <Legend label={i18nKey("register.referredBy")} />
                <UserPill onDeleteUser={deleteUser} userOrGroup={referringUser} />
            {:else}
                <Legend label={i18nKey("register.findReferrer")} />
                <FindUser
                    placeholderKey={"register.searchForReferrer"}
                    {userLookup}
                    onSelectUser={selectUser} />
            {/if}
        </div>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div onclick={onShowGuidelines} class="smallprint">
            <Translatable resourceKey={i18nKey("register.disclaimer")} />
        </div>
        {#if error !== undefined}
            <div class="error">
                <ErrorMessage><Translatable resourceKey={i18nKey(error)} /></ErrorMessage>
            </div>
        {/if}
    </form>
{/if}

<div class="footer">
    <Container gap={"md"} mainAxisAlignment={"end"} crossAxisAlignment={"end"}>
        {#if badCode}
            <CommonButton mode={"default"} onClick={clearCodeAndLogout} size={"small_text"}>
                <Translatable resourceKey={i18nKey("cancel")}></Translatable>
            </CommonButton>
        {/if}
        <CommonButton
            mode={"active"}
            disabled={!usernameValid || busy}
            loading={checkingUsername || busy}
            onClick={register}
            size={"medium"}>
            <Translatable resourceKey={i18nKey("register.proceed")} />
        </CommonButton>
    </Container>
</div>

<style lang="scss">
    :global(.guidelines-modal .card .header:not(.open) .arrow path) {
        fill: var(--txt);
    }
    :global(.username-wrapper .results) {
        max-height: 250px;
        @include nice-scrollbar();
    }

    .username-wrapper {
        margin-bottom: $sp4;
        width: 100%;
    }

    .smallprint {
        margin-top: $sp4;
        align-self: flex-start;
        @include font(light, normal, fs-60);
        color: var(--primary);
        cursor: pointer;
        text-decoration: none;

        @media (hover: hover) {
            &:hover {
                text-decoration: underline;
            }
        }
    }

    .footer {
        align-self: flex-end;
    }

    .error {
        margin-top: $sp4;
    }

    .main {
        margin-bottom: $sp3;
    }

    .sub {
        color: var(--txt-light);
    }
</style>
