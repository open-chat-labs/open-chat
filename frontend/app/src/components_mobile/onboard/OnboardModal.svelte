<script lang="ts">
    import { i18nKey, setLocale, supportedLanguages } from "@src/i18n/i18n";
    import { anonUserStore, identityStateStore, OpenChat, type CreatedUser } from "openchat-client";
    import { getContext } from "svelte";
    import { locale } from "svelte-i18n";
    import FancyLoader from "../icons/FancyLoader.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Select from "../Select.svelte";
    import Translatable from "../Translatable.svelte";
    import ModeSelection from "./ModeSelection.svelte";
    import SignIn from "./SignIn.svelte";
    import SignUp from "./SignUp.svelte";

    const client = getContext<OpenChat>("client");

    type Step = "select_mode" | "sign_up" | "sign_in";

    interface Props {
        step?: Step;
        onClose: () => void;
    }

    let { onClose, step = $bindable("select_mode") }: Props = $props();
    let error: string | undefined = $state(undefined);
    let selectedLocale = $state(($locale as string).substring(0, 2));
    $effect(() => {
        setLocale(selectedLocale);
    });

    function cancel() {
        if ($anonUserStore && $identityStateStore.kind === "logging_in") {
            client.updateIdentityState({ kind: "anon" });
        }
        onClose();
    }

    let spinning = $state(false);

    let title = $derived.by(() => {
        switch (step) {
            case "select_mode":
                return i18nKey("register.welcome");
            case "sign_in":
                return i18nKey("loginDialog.title");
            case "sign_up":
                return i18nKey("loginDialog.signupTitle");
        }
    });

    function onCreatedUser(user: CreatedUser) {
        client.onRegisteredUser(user);
        onClose();
    }

    function logout(e: Event) {
        e.preventDefault();
        e.stopPropagation();
        client.logout();
    }
</script>

<ModalContent
    fill
    hideFooter
    onClose={cancel}
    closeIcon={step === "select_mode"}
    onBack={() => (step = "select_mode")}
    backIcon={step !== "select_mode"}>
    {#snippet header()}
        <div class="header">
            <div class="logo-img">
                <FancyLoader loop={spinning} />
            </div>
            <div class="title">
                <Translatable resourceKey={title} />
                <div class="strapline">
                    <Translatable resourceKey={i18nKey("loginDialog.strapline")} />
                </div>
            </div>
        </div>
    {/snippet}
    {#snippet body()}
        <div class="body">
            {#if step === "select_mode"}
                <ModeSelection
                    onSignIn={() => (step = "sign_in")}
                    onSignUp={() => (step = "sign_up")} />
            {:else if step === "sign_in"}
                <SignIn bind:spinning bind:error {onClose} />
            {:else if step === "sign_up"}
                <SignUp {onCreatedUser} bind:error />
            {/if}
        </div>
    {/snippet}
</ModalContent>

<div class="lang">
    <Select bind:value={selectedLocale}>
        {#each supportedLanguages as lang}
            <option value={lang.code}>{lang.name}</option>
        {/each}
    </Select>
</div>

<a class="logout" role="button" href="/" onclick={logout}>
    <Translatable resourceKey={i18nKey("logout")} />
</a>

<style lang="scss">
    :global(.lang .wrapper .icon) {
        right: -1px;
        top: 1px;
    }

    :global(.lang select.select) {
        @include font(light, normal, fs-90);
        background-color: transparent;
        min-width: 80px;
        height: auto;
        color: #fff;
        padding: $sp2 $sp5 $sp2 $sp4;
        border: 1px solid var(--bd);

        option {
            @include font(light, normal, fs-90);
        }
    }

    .body {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: $sp4;
    }
    .header {
        display: flex;
        gap: $sp3;
        @include font(bold, normal, fs-130, 29);
        @include mobile() {
            @include font(bold, normal, fs-120, 29);
        }
        align-items: center;

        .logo-img {
            height: 56px;
            width: 56px;

            @include mobile() {
                height: 40px;
                width: 40px;
            }
        }

        .strapline {
            @include font(light, normal, fs-80);
            color: var(--txt-light);
        }

        .title {
            display: flex;
            flex-direction: column;
            gap: $sp2;
        }
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
</style>
