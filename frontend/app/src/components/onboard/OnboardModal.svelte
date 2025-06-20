<script lang="ts">
    import { i18nKey, setLocale, supportedLanguages } from "@src/i18n/i18n";
    import { anonUserStore, identityStateStore, OpenChat, type CreatedUser } from "openchat-client";
    import { getContext } from "svelte";
    import { locale } from "svelte-i18n";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import FancyLoader from "../icons/FancyLoader.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Select from "../Select.svelte";
    import Translatable from "../Translatable.svelte";
    import FlowSelection from "./FlowSelection.svelte";
    import SignIn from "./SignIn.svelte";
    import SignUp from "./SignUp.svelte";

    const client = getContext<OpenChat>("client");

    type Step = "select_flow" | "sign_up" | "sign_in";

    interface Props {
        step?: Step;
        onClose: () => void;
    }

    let { onClose, step = $bindable("select_flow") }: Props = $props();
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
            case "select_flow":
                return i18nKey("Welcome to OpenChat");
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
</script>

<ModalContent hideHeader fill hideFooter onClose={cancel} closeIcon>
    {#snippet body()}
        <div class="header login">
            <div class="main">
                <div class="logo-img">
                    <FancyLoader loop={spinning} />
                </div>
                <div class="title">
                    <Translatable resourceKey={title} />
                    <div class="strapline">
                        <Translatable resourceKey={i18nKey("loginDialog.strapline")} />
                    </div>
                </div>

                <span class="close">
                    {#if step === "select_flow"}
                        <HoverIcon onclick={cancel}>
                            <Close size={"1em"} color={"var(--icon-txt)"} />
                        </HoverIcon>
                    {:else}
                        <HoverIcon onclick={() => (step = "select_flow")}>
                            <ArrowLeft size={"1em"} color={"var(--icon-txt)"} />
                        </HoverIcon>
                    {/if}
                </span>
            </div>
        </div>
        <div class="body">
            {#if step === "select_flow"}
                <FlowSelection
                    {onClose}
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
        padding: $sp2 $sp4;
        padding-right: $sp5;
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
        padding: $sp5;
        display: flex;
        flex-direction: column;
        gap: $sp3;
        @include font(bold, normal, fs-130, 29);
        @include mobile() {
            @include font(bold, normal, fs-120, 29);
        }

        .main {
            display: flex;
            gap: $sp3;
            align-items: center;

            .close {
                align-self: flex-start;
            }
        }

        .logo-img {
            height: 48px;
            width: 48px;

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
            flex: auto;
        }
    }

    .lang {
        position: absolute;
        left: $sp3;
        top: $sp3;
    }
</style>
