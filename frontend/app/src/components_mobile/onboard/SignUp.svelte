<script lang="ts">
    import { i18nKey, interpolate } from "@src/i18n/i18n";
    import {
        BodySmall,
        Button,
        Column,
        Container,
        Form,
        Input,
        Sheet,
        Spinner,
        StatusCard,
        Subtitle,
        Switch,
    } from "component-lib";
    import type { OpenChat, UserOrUserGroup, UserSummary } from "@client";
    import { getContext, onDestroy, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import ErrorMessage from "../ErrorMessage.svelte";
    import FindUser from "../FindUser.svelte";
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
    let emailValid = $derived(form.emailValid);
    let busy = $derived(form.busy);
    let badCode = $derived(form.referralRefused);
    let referringUser = $derived(form.referrer?.user);
    let termsAccepted = $state(false);

    let TermsContent: typeof import("../TermsContent.svelte").default | undefined =
        $state(undefined);
    let termsLoadFailed = $state(false);

    function onShowGuidelines() {
        showGuidelines = true;
        client.gaTrack("show_guidelines_clicked", "registration");
        if (TermsContent === undefined) {
            termsLoadFailed = false;
            import("../TermsContent.svelte")
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
    <Sheet onDismiss={onCloseGuidelines}>
        <Container gap={"lg"} direction={"vertical"} padding={"xl"}>
            <Subtitle>OpenChat Terms</Subtitle>
            {#if TermsContent}
                <TermsContent />
            {:else if termsLoadFailed}
                <ErrorMessage>Unable to load the terms. Please try again.</ErrorMessage>
            {:else}
                <div aria-busy="true"><Spinner /></div>
            {/if}
            <Button
                onClick={onCloseGuidelines}
                disabled={TermsContent === undefined && !termsLoadFailed}>
                <Translatable resourceKey={i18nKey("register.agree")} />
            </Button>
        </Container>
    </Sheet>
{/if}

<Container padding={["md", "zero", "xxl", "zero"]}>
    {#if badCode}
        <StatusCard
            mode={"warning"}
            title={interpolate($_, i18nKey("register.referralCodeInvalid"))}>
            {#snippet body()}
                <Translatable resourceKey={i18nKey("register.doYouWantToProceed")} />
            {/snippet}
        </StatusCard>
    {:else}
        <Form onSubmit={register}>
            <Container gap={"xl"} direction={"vertical"}>
                <UsernameInput
                    check={usernameCheck}
                    disabled={busy}
                    errorMsg={error}
                    onChange={() => (error = undefined)} />

                <Input
                    error={!emailValid}
                    disabled={busy}
                    placeholder={interpolate($_, i18nKey("register.emailPlaceholder"))}
                    bind:value={form.email}
                    minlength={0}
                    maxlength={254}>
                    {#snippet subtext()}
                        <Translatable resourceKey={i18nKey("register.emailRules")} />
                    {/snippet}
                </Input>

                {#if referringUser !== undefined}
                    <Column padding={["zero", "md"]}>
                        <UserPill onDeleteUser={deleteUser} userOrGroup={referringUser} />
                    </Column>
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
    {#if badCode}
        <!-- turned the code down: give up the sign-up (sign out) rather than go on without it -->
        <Button width={"fill"} secondary onClick={clearCodeAndLogout}>
            <Translatable resourceKey={i18nKey("cancel")} />
        </Button>
    {/if}
    <Button
        width={"fill"}
        disabled={!termsAccepted || !usernameCheck.valid || !emailValid || busy}
        loading={usernameCheck.checking || busy}
        onClick={register}>
        <Translatable resourceKey={i18nKey("Start my journey")} />
    </Button>
</Container>
