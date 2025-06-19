<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import type { OpenChat, UserOrUserGroup, UserSummary } from "openchat-client";
    import { mobileWidth } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { writable, type Writable } from "svelte/store";
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
        onClose: () => void;
        error: string | undefined;
    }

    let { error = $bindable() }: Props = $props();

    let showGuidelines = $state(false);
    let username = $state("");
    let usernameValid = $state(false);
    let usernameStore: Writable<string | undefined> = writable(undefined);
    let checkingUsername: boolean = $state(false);
    // let busy = $derived($registerState.kind === "spinning");
    let busy = $state(false);
    let referringUser: UserSummary | undefined = $state(undefined);

    function onShowGuidelines() {
        showGuidelines = true;
        client.gaTrack("show_guidelines_clicked", "registration");
    }
    function onCloseGuidelines() {
        showGuidelines = false;
    }

    function register(e: Event) {
        e.preventDefault();
        if (usernameValid) {
            usernameStore.set(username);
            // registerUser(username);
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

<form class="username-wrapper" onsubmit={register}>
    <div class="form-element">
        <Legend label={i18nKey("username")} rules={i18nKey("usernameRules")} />
        <UsernameInput
            {client}
            disabled={busy}
            originalUsername={$usernameStore ?? ""}
            autofocus={true}
            bind:username
            bind:usernameValid
            bind:checking={checkingUsername}
            bind:error />
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

<div class="footer">
    <Button loading={checkingUsername || busy} disabled={!usernameValid || busy} onClick={register}>
        <Translatable resourceKey={i18nKey("register.next")} />
    </Button>
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
</style>
