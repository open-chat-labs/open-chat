<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { createLocalStorageStore } from "@src/utils/store";
    import EmailValidator from "email-validator";
    import type { OpenChat, SignUpOutcome, UserOrUserGroup, UserSummary } from "@client";
    import { mobileWidth } from "@client";
    import { getContext, onMount } from "svelte";
    import AlertBox from "../AlertBox.svelte";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Checkbox from "../Checkbox.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import { Spinner } from "component-lib";
    import FindUser from "../FindUser.svelte";
    import Input from "../Input.svelte";
    import Legend from "../Legend.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import UsernameInput from "../UsernameInput.svelte";
    import UserPill from "../UserPill.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        // the account is made and the client has the user
        onSignedUp: () => void;
        error: string | undefined;
    }

    let { error = $bindable(), onSignedUp }: Props = $props();

    let showGuidelines = $state(false);
    let username = $state("");
    let usernameValid = $state(false);
    const usernameStore = createLocalStorageStore("openchat_candidate_username", "");
    let checkingUsername: boolean = $state(false);
    let email = $state("");
    let emailValid = $derived(email.length === 0 || EmailValidator.validate(email));
    let busy = $state(false);
    let badCode = $state(false);
    let termsAccepted = $state(false);
    let referringUser: UserSummary | undefined = $state(undefined);

    let TermsContent: typeof import("../landingpages/TermsContent.svelte").default | undefined =
        $state(undefined);
    let termsLoadFailed = $state(false);

    function onShowGuidelines() {
        showGuidelines = true;
        client.gaTrack("show_guidelines_clicked", "registration");
        if (TermsContent === undefined) {
            termsLoadFailed = false;
            import("../landingpages/TermsContent.svelte")
                .then((m) => (TermsContent = m.default))
                .catch(() => (termsLoadFailed = true));
        }
    }
    function onCloseGuidelines() {
        showGuidelines = false;
    }

    async function register(e: Event) {
        e.preventDefault();
        if (!usernameValid || !emailValid || !termsAccepted || busy) return;
        usernameStore.set(username);
        busy = true;
        let outcome: SignUpOutcome;
        try {
            // a refused referral code isn't sent again, so "proceed" signs up without it
            outcome = await client.signUp(
                username,
                email.length > 0 ? email : undefined,
                termsAccepted,
            );
        } finally {
            busy = false;
        }
        badCode = outcome.kind === "referral_refused";
        switch (outcome.kind) {
            case "success":
                error = undefined;
                usernameStore.set("");
                onSignedUp();
                break;
            case "referral_refused":
            case "failed":
                error = outcome.reason.key;
                break;
        }
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
                    {#if TermsContent}
                        <TermsContent />
                    {:else if termsLoadFailed}
                        <ErrorMessage>Unable to load the terms. Please try again.</ErrorMessage>
                    {:else}
                        <div aria-busy="true"><Spinner /></div>
                    {/if}
                </span>
            {/snippet}
            {#snippet footer(onClose)}
                <span>
                    <Button
                        onClick={() => onClose?.()}
                        disabled={TermsContent === undefined && !termsLoadFailed}
                        small={!$mobileWidth}
                        tiny={$mobileWidth}>
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
                autofocus
                bind:username
                bind:usernameValid
                bind:checking={checkingUsername}
                bind:error />
        </div>

        <div class="form-element">
            <Legend label={i18nKey("register.email")} rules={i18nKey("register.emailRules")} />

            <Input
                invalid={!emailValid}
                disabled={busy}
                placeholder={i18nKey("register.emailPlaceholder")}
                bind:value={email}
                minlength={0}
                maxlength={254} />
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
                    enabled
                    compact
                    mode={"add"}
                    autofocus={false}
                    onSelectUser={selectUser} />
            {/if}
        </div>
        <div class="terms">
            <Checkbox id="sign-up-terms" label={undefined} bind:checked={termsAccepted}>
                <!-- the words open the terms; the box ticks -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <span
                    class="smallprint"
                    onclick={(e) => {
                        e.preventDefault();
                        onShowGuidelines();
                    }}>
                    <Translatable
                        resourceKey={i18nKey("I agree to the OpenChat terms & conditions")} />
                </span>
            </Checkbox>
        </div>
        {#if error !== undefined}
            <div class="error">
                <ErrorMessage><Translatable resourceKey={i18nKey(error)} /></ErrorMessage>
            </div>
        {/if}
    </form>
{/if}

<div class="footer">
    <ButtonGroup>
        {#if badCode}
            <Button secondary onClick={clearCodeAndLogout}
                ><Translatable resourceKey={i18nKey("cancel")} /></Button>
        {/if}
        <Button
            loading={checkingUsername || busy}
            disabled={!usernameValid || !emailValid || !termsAccepted || busy}
            onClick={register}>
            <Translatable resourceKey={i18nKey("register.proceed")} />
        </Button>
    </ButtonGroup>
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

    .terms {
        margin-top: $sp4;
    }

    .smallprint {
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
