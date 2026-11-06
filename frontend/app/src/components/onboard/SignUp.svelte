<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import type { OpenChat, UserOrUserGroup, UserSummary } from "@client";
    import { mobileWidth } from "@client";
    import { getContext, onDestroy, onMount } from "svelte";
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
    import { SignUpForm } from "@src/logic/auth/signUpForm.svelte";
    import UserPill from "../UserPill.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        // the account is made and the client has the user
        onSignedUp: () => void;
        error: string | undefined;
    }

    let { error = $bindable(), onSignedUp }: Props = $props();

    let showGuidelines = $state(false);
    // the form (logic/auth/signUpForm): the name last tried, if sign-up didn't finish, is where it
    // starts; the referral link's referrer, or one picked
    const form = new SignUpForm(client);
    const usernameCheck = form.username;
    onDestroy(() => form.destroy());
    // sign-up's own failure, else why the name can't be used
    let shownError = $derived(error ?? usernameCheck.error);
    let emailValid = $derived(form.emailValid);
    let busy = $derived(form.busy);
    let badCode = $derived(form.referralRefused);
    let termsAccepted = $state(false);
    let referringUser = $derived(form.referrer?.user);

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
        // Enter submits the form too, so the terms are checked here as well as on the button; a
        // refused referral code isn't sent again, so "proceed" signs up without it
        const outcome = await form.submit(termsAccepted);
        switch (outcome?.kind) {
            case "success":
                error = undefined;
                onSignedUp();
                break;
            case "referral_refused":
            case "failed":
                error = form.error;
                break;
        }
    }

    function deleteUser(_: UserOrUserGroup) {
        form.removeReferrer();
    }

    function selectUser(user: UserSummary) {
        form.pickReferrer(user, "search");
    }

    function userLookup(searchTerm: string): Promise<[UserSummary[], UserSummary[]]> {
        return client.searchUsers(searchTerm, 20).then((res) => [[], res]);
    }

    function clearCodeAndLogout() {
        client.clearReferralCode();
        client.logout();
    }

    onMount(() => {
        form.loadLinkReferrer();
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
                check={usernameCheck}
                disabled={busy}
                autofocus
                onChange={() => (error = undefined)} />
        </div>

        <div class="form-element">
            <Legend label={i18nKey("register.email")} rules={i18nKey("register.emailRules")} />

            <Input
                invalid={!emailValid}
                disabled={busy}
                placeholder={i18nKey("register.emailPlaceholder")}
                bind:value={form.email}
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
        {#if shownError !== undefined}
            <div class="error">
                <ErrorMessage><Translatable resourceKey={i18nKey(shownError)} /></ErrorMessage>
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
            loading={usernameCheck.checking || busy}
            disabled={!usernameCheck.valid || !emailValid || !termsAccepted || busy}
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

    // the small print's size for the whole row, so the box (sized in em) matches its words and
    // the two sit on one centre line
    .terms {
        margin-top: $sp4;
        @include font(light, normal, fs-80);

        :global(.checkbox) {
            gap: $sp3;
        }
    }

    .smallprint {
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
