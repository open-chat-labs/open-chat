<script lang="ts">
    import { i18nKey, setLocale } from "@src/i18n/i18n";
    import { Container, H1, Logo, Overview, Sheet, Subtitle } from "component-lib";
    import { anonUserStore, identityStateStore, OpenChat, type CreatedUser } from "openchat-client";
    import { getContext } from "svelte";
    import { locale } from "svelte-i18n";
    import MulticolourText from "../MulticolourText.svelte";
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

    function onCreatedUser(user: CreatedUser) {
        client.onRegisteredUser(user);
        onClose();
    }
</script>

<Sheet onDismiss={cancel}>
    <Container padding={"xxl"} gap={"xl"} direction={"vertical"}>
        <Container crossAxisAlignment={"center"} gap={"md"}>
            <Logo size={"md"} />
            <H1 fontWeight={"bold"}>OpenChat</H1>
        </Container>

        <Overview fontWeight={"light"} width={{ kind: "fixed", size: "70%" }}>
            <Translatable resourceKey={i18nKey("Full featured. Fully secure.")} />
        </Overview>

        <Subtitle fontWeight={"bold"}>
            <MulticolourText
                parts={[
                    {
                        text: i18nKey("OpenChat"),
                        colour: "primary",
                    },
                    {
                        text: i18nKey(" is a"),
                        colour: "textSecondary",
                    },
                    {
                        text: i18nKey(" community-owned"),
                        colour: "secondary",
                    },
                    {
                        text: i18nKey(" chat application built for"),
                        colour: "textSecondary",
                    },
                    {
                        text: i18nKey(" privacy,"),
                        colour: "primary",
                    },
                    {
                        text: i18nKey(" security,"),
                        colour: "success",
                    },
                    {
                        text: i18nKey(" and"),
                        colour: "textSecondary",
                    },
                    {
                        text: i18nKey(" anonymity."),
                        colour: "warning",
                    },
                ]}></MulticolourText>
        </Subtitle>
        {#if step === "select_mode"}
            <ModeSelection
                onSignIn={() => (step = "sign_in")}
                onSignUp={() => (step = "sign_up")} />
        {:else if step === "sign_in"}
            <SignIn bind:spinning bind:error {onClose} />
        {:else if step === "sign_up"}
            <SignUp {onCreatedUser} bind:error />
        {/if}
    </Container>
</Sheet>
