<script lang="ts">
    import ModalContent from "../ModalContent.svelte";
    import { _ } from "svelte-i18n";
    import FancyLoader from "../icons/FancyLoader.svelte";
    import Button from "../Button.svelte";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { AuthProvider, type OpenChat } from "openchat-client";
    import ButtonGroup from "../ButtonGroup.svelte";
    import InternetIdentityLogo from "../landingpages/InternetIdentityLogo.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let state: "idle" | "confirming" | "logging-in" = "idle";

    $: identityState = client.identityState;
    $: selectedAuthProviderStore = client.selectedAuthProviderStore;
    let selected = $selectedAuthProviderStore;

    onMount(() => {
        selected = $selectedAuthProviderStore;
    });

    $: console.log("Selected auth provider: ", $selectedAuthProviderStore);

    $: {
        if ($identityState === "anon" && state === "logging-in") {
            dispatch("close");
        }
        if ($identityState === "logged_in") {
            dispatch("close");
        }
    }

    function cancel() {
        if (client.anonUser && $identityState === "logging_in") {
            identityState.set("anon");
        }
        dispatch("close");
    }

    function login(provider: AuthProvider) {
        if (provider !== $selectedAuthProviderStore && state !== "confirming") {
            selected = provider;
            state = "confirming";
            return;
        }
        selectedAuthProviderStore.set(provider);
        client.login();
        state = "logging-in";
    }
</script>

<ModalContent on:close={cancel} closeIcon>
    <div class="header" slot="header">{$_("login")}</div>
    <div class="body" slot="body">
        <div class="msg">
            {#if state === "logging-in"}
                <div class="spinner">
                    <FancyLoader loop />
                </div>
            {/if}
            <p class="sub">
                {#if state === "confirming"}
                    {$_("loginProviderChanged", {
                        values: { previous: $selectedAuthProviderStore, next: selected },
                    })}
                {:else if state === "logging-in"}
                    {$_("loggingInPleaseWait")}
                {:else}
                    {$_("toProceedLogin")}
                {/if}
            </p>
        </div>
    </div>
    <div slot="footer">
        {#if state !== "logging-in"}
            <ButtonGroup align="center">
                <Button
                    secondary={selected !== AuthProvider.II}
                    on:click={() => login(AuthProvider.II)}>
                    <div class="provider">
                        <div class="ii-img">
                            <InternetIdentityLogo />
                        </div>
                        {AuthProvider.II}
                    </div>
                </Button>
                <Button
                    secondary={selected !== AuthProvider.NFID}
                    on:click={() => login(AuthProvider.NFID)}>
                    <div class="provider">
                        <img class="nfid-img" src="/assets/nfid.svg" alt="" />
                        {AuthProvider.NFID}
                    </div>
                </Button>
            </ButtonGroup>
        {/if}
    </div>
</ModalContent>

<style lang="scss">
    .msg {
        display: flex;
        flex-direction: column;
        gap: $sp5;
        align-items: center;
        margin-bottom: $sp3;
    }
    .spinner {
        flex: 0 0 80px;
        width: 80px;
    }
    .sub {
        flex: auto;
        @include font(book, normal, fs-120, 32);
    }
    .provider {
        display: flex;
        gap: $sp3;

        .ii-img,
        .nfid-img {
            width: 20px;
        }
    }
</style>
