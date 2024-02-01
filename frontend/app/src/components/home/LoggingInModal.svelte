<script lang="ts">
    import { fade } from "svelte/transition";
    import ModalContent from "../ModalContent.svelte";
    import Alert from "svelte-material-icons/Alert.svelte";
    import Radio from "../Radio.svelte";
    import Button from "../Button.svelte";
    import { createEventDispatcher, getContext, onDestroy, onMount } from "svelte";
    import { AuthProvider, type OpenChat } from "openchat-client";
    import InternetIdentityLogo from "../landingpages/InternetIdentityLogo.svelte";
    import { iconSize } from "../../stores/iconSize";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let state: "idle" | "confirming" | "logging-in" = "idle";
    let expanded = false;

    $: anonUser = client.anonUser;
    $: identityState = client.identityState;
    $: selectedAuthProviderStore = client.selectedAuthProviderStore;

    let selected = $selectedAuthProviderStore;
    let warn = false;
    let previouslySignedIn = false;

    onMount(async () => {
        selected = $selectedAuthProviderStore;
        previouslySignedIn = await client.previouslySignedIn();
    });

    onDestroy(() => {
        if ($anonUser && $identityState.kind === "logging_in") {
            identityState.set({ kind: "anon" });
        }
    });

    $: {
        if ($identityState.kind === "anon" && state === "logging-in") {
            dispatch("close");
        }
        if ($identityState.kind === "logged_in") {
            dispatch("close");
        }
    }

    function cancel() {
        if ($anonUser && $identityState.kind === "logging_in") {
            identityState.set({ kind: "anon" });
        }
        dispatch("close");
    }

    function login() {
        selectedAuthProviderStore.set(selected);
        client.login();
        state = "logging-in";
    }

    function selectProvider(provider: AuthProvider) {
        selected = provider;
        warn = previouslySignedIn && selected !== $selectedAuthProviderStore;
    }
</script>

<ModalContent compactFooter on:close={cancel} closeIcon>
    <div class="header" slot="header">
        <Translatable resourceKey={i18nKey("loginToOpenChat")} />
    </div>
    <div class="body" slot="body">
        {#if warn}
            <div transition:fade|local={{ duration: 300 }} class="confirming">
                <div class="alert">
                    <Alert size={$iconSize} color={"var(--warn"} />
                </div>
                <div class="alert-txt">
                    <Translatable
                        resourceKey={i18nKey("loginProviderChanged", {
                            previous: $selectedAuthProviderStore,
                            next: selected,
                        })} />
                </div>
            </div>
        {/if}
        <div class="cta">
            <Button
                disabled={state === "logging-in"}
                loading={state === "logging-in"}
                on:click={() => login()}>
                <Translatable resourceKey={i18nKey("login")} />
            </Button>
        </div>
    </div>

    <div class="footer" slot="footer">
        <a
            role="button"
            tabindex="0"
            on:click={() => (expanded = !expanded)}
            class="options"
            class:expanded>
            <Translatable
                resourceKey={i18nKey(expanded ? "hideAuthProviders" : "showAuthProviders")} />
        </a>

        {#if expanded}
            <div in:fade|local={{ duration: 300 }} class="auth-providers">
                <Radio
                    id="ii_auth"
                    compact
                    group="authprovider"
                    value={AuthProvider.II}
                    label={i18nKey(AuthProvider.II)}
                    disabled={state === "logging-in"}
                    checked={selected === AuthProvider.II}
                    on:change={() => selectProvider(AuthProvider.II)}>
                    <div class="provider">
                        <div class="ii-img">
                            <InternetIdentityLogo />
                        </div>
                        {AuthProvider.II}
                    </div>
                </Radio>
                <Radio
                    id="nfid_auth"
                    compact
                    group="authprovider"
                    value={AuthProvider.NFID}
                    label={i18nKey(AuthProvider.NFID)}
                    disabled={state === "logging-in"}
                    checked={selected === AuthProvider.NFID}
                    on:change={() => selectProvider(AuthProvider.NFID)}>
                    <div class="provider">
                        <img class="nfid-img" src="/assets/nfid.svg" alt="" />
                        {AuthProvider.NFID}
                    </div>
                </Radio>
            </div>
        {/if}
    </div>
</ModalContent>

<style lang="scss">
    :global(.auth-providers .radio) {
        margin-bottom: 0 !important;
    }

    .body,
    .header {
        text-align: center;
    }

    .provider {
        display: flex;
        gap: $sp3;
        background-color: var(--chatSummary-bg-selected);
        padding: $sp2 $sp3;
        border-radius: $sp3;

        .ii-img,
        .nfid-img {
            width: 30px;
        }
    }

    .auth-providers {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
        gap: $sp4;
        @include font-size(fs-80);

        @include mobile() {
            flex-direction: column;
            gap: $sp3;
        }
    }

    .confirming {
        text-align: start;
        @include font(book, normal, fs-100, 30);
        padding: $sp4;
        border: 1px solid var(--warn);
        display: flex;
        align-items: flex-start;
        gap: $sp3;
        border-radius: var(--rd);
        margin-bottom: $sp4;

        .alert {
            flex: 0 0 25px;
        }

        .alert-txt {
            flex: auto;
        }
    }

    .footer {
        text-align: center;

        .options {
            @include font(light, normal, fs-80);
            display: block;
            &.expanded {
                margin-bottom: $sp4;
            }
        }
    }
</style>
