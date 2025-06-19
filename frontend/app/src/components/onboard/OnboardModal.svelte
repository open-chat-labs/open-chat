<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../HoverIcon.svelte";
    import FancyLoader from "../icons/FancyLoader.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Translatable from "../Translatable.svelte";
    import FlowSelection from "./FlowSelection.svelte";
    import SignIn from "./SignIn.svelte";
    import SignUp from "./SignUp.svelte";

    type Step = "select_flow" | "sign_up" | "sign_in";

    interface Props {
        onClose: () => void;
    }

    let { onClose }: Props = $props();
    let step = $state<Step>("select_flow");
    let error: string | undefined = $state(undefined);

    function cancel() {
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
                    <HoverIcon onclick={onClose}>
                        <Close size={"1em"} color={"var(--icon-txt)"} />
                    </HoverIcon>
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
                <SignIn bind:error onClose={() => (step = "select_flow")} />
            {:else if step === "sign_up"}
                <SignUp bind:error onClose={() => (step = "select_flow")} />
            {/if}
        </div>
    {/snippet}
</ModalContent>

<style lang="scss">
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
</style>
