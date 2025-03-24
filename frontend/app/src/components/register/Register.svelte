<script lang="ts">
    import Alert from "svelte-material-icons/Alert.svelte";
    import { locale } from "svelte-i18n";
    import { i18nKey, setLocale, supportedLanguages } from "../../i18n/i18n";
    import Toast from "../Toast.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import UsernameInput from "../UsernameInput.svelte";
    import { getContext, onMount } from "svelte";
    import { writable, type Writable } from "svelte/store";
    import { type CreatedUser, type OpenChat, type UserSummary } from "openchat-client";
    import Button from "../Button.svelte";
    import Select from "../Select.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";
    import Legend from "../Legend.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Translatable from "../Translatable.svelte";
    import { iconSize } from "../../stores/iconSize";
    import TermsContent from "../landingpages/TermsContent.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import FindUser from "../FindUser.svelte";
    import UserPill from "../UserPill.svelte";

    interface Props {
        onCreatedUser: (user: CreatedUser) => void;
        onClose?: () => void;
    }

    let { onCreatedUser, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");

    type Spinning = { kind: "spinning" };
    type AwaitingUsername = { kind: "awaiting_username" };

    type RegisterState = Spinning | AwaitingUsername;

    let registerState: Writable<RegisterState> = writable({ kind: "awaiting_username" });
    let error: Writable<string | undefined> = writable(undefined);
    let usernameStore: Writable<string | undefined> = writable(undefined);
    let createdUser: CreatedUser | undefined = undefined;
    let closed: boolean = false;
    let showGuidelines = $state(false);
    let username = $state("");
    let usernameValid = $state(false);
    let checkingUsername: boolean = $state(false);
    let badCode = $state(false);
    let referringUser: UserSummary | undefined = $state(undefined);

    function clearCodeAndRegister(e: Event) {
        client.clearReferralCode();
        register(e);
    }

    function clearCodeAndLogout() {
        client.clearReferralCode();
        client.logout();
    }

    function logout(e: Event) {
        e.preventDefault();
        e.stopPropagation();
        client.logout();
    }

    function register(e: Event) {
        e.preventDefault();
        if (usernameValid) {
            usernameStore.set(username);
            registerUser(username);
        }
    }

    function onShowGuidelines() {
        showGuidelines = true;
        client.gaTrack("show_guidelines_clicked", "registration");
    }

    function registerUser(username: string): void {
        registerState.set({ kind: "spinning" });
        client.registerUser(username).then((resp) => {
            badCode = false;
            registerState.set({ kind: "awaiting_username" });
            if (resp.kind === "username_taken") {
                error.set("register.usernameTaken");
            } else if (resp.kind === "username_too_short") {
                error.set("register.usernameTooShort");
            } else if (resp.kind === "username_too_long") {
                error.set("register.usernameTooLong");
            } else if (resp.kind === "username_invalid") {
                error.set("register.usernameInvalid");
            } else if (resp.kind === "user_limit_reached") {
                error.set("register.userLimitReached");
            } else if (resp.kind === "internal_error") {
                error.set("unexpectedError");
            } else if (resp.kind === "referral_code_invalid") {
                error.set("register.referralCodeInvalid");
                badCode = true;
            } else if (resp.kind === "referral_code_already_claimed") {
                error.set("register.referralCodeAlreadyClaimed");
                badCode = true;
            } else if (resp.kind === "referral_code_expired") {
                error.set("register.referralCodeExpired");
                badCode = true;
            } else if (resp.kind === "success") {
                error.set(undefined);
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
                };
                onCreatedUser(createdUser);
            } else {
                error.set(`Unexpected register user response: ${resp.kind}`);
            }
        });
    }

    let selectedLocale = $state(($locale as string).substring(0, 2));
    $effect(() => {
        setLocale(selectedLocale);
    });
    let busy = $derived($registerState.kind === "spinning");

    function deleteUser() {
        referringUser = undefined;
        client.clearReferralCode();
    }

    function selectUser(ev: CustomEvent<UserSummary>) {
        referringUser = ev.detail;
        client.setReferralCode(ev.detail.userId);
    }

    function userLookup(searchTerm: string): Promise<[UserSummary[], UserSummary[]]> {
        return client.searchUsers(searchTerm, 20).then((res) => [[], res]);
    }

    onMount(async () => {
        referringUser = await client.getReferringUser();
    });

    function onCloseGuidelines() {
        showGuidelines = false;
    }
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
                    <Button on:click={() => onClose?.()} small={!$mobileWidth} tiny={$mobileWidth}>
                        <Translatable resourceKey={i18nKey("register.agree")} />
                    </Button>
                </span>
            {/snippet}
        </ModalContent>
    </Overlay>
{/if}

<ModalContent compactFooter {onClose}>
    {#snippet header()}
        <div class="header">
            <div class="subtitle">
                <div class="logo"></div>
                {#if closed}
                    <h4><Translatable resourceKey={i18nKey("register.closedTitle")} /></h4>
                {:else if badCode}
                    <h4><Translatable resourceKey={i18nKey("register.invalidCode")} /></h4>
                {:else}
                    <h4><Translatable resourceKey={i18nKey("register.title")} /></h4>
                {/if}
            </div>
        </div>
    {/snippet}
    {#snippet body()}
        <div class="body">
            {#if closed}
                <div class="closed">
                    <h4><Translatable resourceKey={i18nKey("register.closed")} /></h4>
                </div>
            {:else if badCode}
                <div class="bad-code">
                    <div class="alert">
                        <Alert size={$iconSize} color={"var(--warn"} />
                    </div>
                    <div class="alert-txt">
                        <h4 class="main">
                            <Translatable resourceKey={i18nKey("register.referralCodeInvalid")} />
                        </h4>
                        <p class="sub">
                            <Translatable resourceKey={i18nKey("register.doYouWantToProceed")} />
                        </p>
                    </div>
                </div>
            {:else}
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
                            bind:error={$error} />
                    </div>

                    <div class="form-element">
                        {#if referringUser !== undefined}
                            <Legend label={i18nKey("register.referredBy")} />
                            <UserPill on:deleteUser={deleteUser} userOrGroup={referringUser} />
                        {:else}
                            <Legend label={i18nKey("register.findReferrer")} />
                            <FindUser
                                placeholderKey={"register.searchForReferrer"}
                                {userLookup}
                                enabled
                                compact
                                mode={"add"}
                                autofocus={false}
                                on:selectUser={selectUser} />
                        {/if}
                    </div>
                </form>

                {#if $error}
                    <ErrorMessage><Translatable resourceKey={i18nKey($error)} /></ErrorMessage>
                {/if}
                <div onclick={onShowGuidelines} class="smallprint">
                    <Translatable resourceKey={i18nKey("register.disclaimer")} />
                </div>
            {/if}
        </div>
    {/snippet}
    {#snippet footer()}
        <div class="footer">
            {#if closed}
                <Button on:click={logout}><Translatable resourceKey={i18nKey("close")} /></Button>
            {:else if badCode}
                <ButtonGroup>
                    <Button secondary on:click={clearCodeAndLogout}
                        ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                    <Button
                        loading={checkingUsername || busy}
                        disabled={!usernameValid || busy}
                        on:click={clearCodeAndRegister}
                        ><Translatable resourceKey={i18nKey("register.proceed")} /></Button>
                </ButtonGroup>
            {:else}
                <Button
                    loading={checkingUsername || busy}
                    disabled={!usernameValid || busy}
                    on:click={register}>
                    <Translatable resourceKey={i18nKey("register.createUser")} />
                </Button>
            {/if}
        </div>
    {/snippet}
</ModalContent>

<a class="logout" role="button" href="/" onclick={logout}>
    <Translatable resourceKey={i18nKey("logout")} />
</a>

<div class="lang">
    <Select bind:value={selectedLocale}>
        {#each supportedLanguages as lang}
            <option value={lang.code}>{lang.name}</option>
        {/each}
    </Select>
</div>

<Toast />

<style lang="scss">
    :global(.guidelines-modal .card .header:not(.open) .arrow path) {
        fill: var(--txt);
    }
    :global(.lang select.select) {
        @include font(light, normal, fs-90);
        background-color: transparent;
        padding: 0;
        min-width: 80px;
        height: auto;
        border: none;
        border-bottom: 1px solid var(--accent);
        color: #fff;

        option {
            @include font(light, normal, fs-90);
        }
    }
    :global(.username-wrapper .results) {
        max-height: 250px;
        @include nice-scrollbar();
    }

    .header,
    .body {
        color: var(--txt);
    }
    .lang {
        position: absolute;
        left: $sp3;
        top: $sp3;
    }
    .logout {
        @include font(light, normal, fs-90);
        cursor: pointer;
        position: absolute;
        top: $sp3;
        right: $sp3;
        color: #fff;
        text-decoration: underline;
        text-decoration-color: var(--accent);
        text-underline-offset: $sp1;
        @media (hover: hover) {
            &:hover {
                text-decoration-thickness: 2px;
            }
        }
    }

    .subtitle {
        display: flex;
        align-items: center;
        gap: $sp4;
        @include font(bold, normal, fs-120);

        .logo {
            background-image: url("/assets/spinner.svg");
            width: toRem(30);
            height: toRem(30);
        }
    }

    .bad-code {
        padding: $sp4;
        border: 1px solid var(--warn);
        display: flex;
        align-items: flex-start;
        gap: $sp3;
        border-radius: var(--rd);

        .alert {
            flex: 0 0 25px;
        }

        .alert-txt {
            flex: auto;

            .main {
                margin-bottom: $sp3;
            }

            .sub {
                color: var(--txt-light);
            }
        }
    }

    .closed {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: $sp5;
        flex: auto;
    }

    .username-wrapper {
        margin-bottom: $sp6;
    }

    .smallprint {
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
</style>
