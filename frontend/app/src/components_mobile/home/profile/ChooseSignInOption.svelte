<script lang="ts">
    import { Body, Container, Form, Input } from "component-lib";
    import { AuthProvider, selectedAuthProviderStore, type OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import SendIcon from "svelte-material-icons/Send.svelte";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import SignInOption from "./SignInOption.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        mode?: "signin" | "signup";
        restrictTo?: Set<string>;
        emailInvalid: boolean;
        email: string;
        currentProvider?: AuthProvider | undefined;
        showMore?: boolean;
        onLogin: (provider: AuthProvider) => void;
    }

    let {
        mode = "signin",
        restrictTo = new Set(),
        emailInvalid = $bindable(),
        email = $bindable(),
        currentProvider = undefined,
        showMore = $bindable(false),
        onLogin,
    }: Props = $props();

    function buildOptions(
        selected: AuthProvider | undefined,
        mode: "signin" | "signup",
        restrictTo: Set<string>,
    ): AuthProvider[] {
        let options = [];
        const supportsII = "PublicKeyCredential" in window;

        options.push(AuthProvider.EMAIL);
        options.push(AuthProvider.PASSKEY);

        if (supportsII) {
            options.push(AuthProvider.II);
            options.push(AuthProvider.ETH);
            options.push(AuthProvider.SOL);

            if (mode === "signin") {
                options.push(AuthProvider.NFID);
            }
        } else if (client.isNativeAndroid()) {
            options.push(AuthProvider.II);
        }

        if (restrictTo.size > 0) {
            options = options.filter((o) => {
                return (
                    restrictTo.has(o) ||
                    (o === AuthProvider.II && restrictTo.has("II")) ||
                    (o === AuthProvider.EMAIL && restrictTo.has("EMAIL")) ||
                    (o === AuthProvider.PASSKEY && restrictTo.has("PASSKEY")) ||
                    (o === AuthProvider.ETH && restrictTo.has("ETH")) ||
                    (o === AuthProvider.SOL && restrictTo.has("SOL")) ||
                    (o === AuthProvider.NFID && restrictTo.has("NFID"))
                );
            });
        }

        if (selected !== undefined) {
            let i = options.findIndex((p) => p === selected);

            if (i >= 0) {
                options.splice(i, 1);
                options.splice(0, 0, selected);
            }
        }
        return options;
    }

    function providerName(provider: AuthProvider): string {
        return provider === AuthProvider.NFID ? "NFID (Legacy)" : provider;
    }

    function isEmailValid(email: string): boolean {
        return email.length > 0;
    }

    let options = $derived(
        buildOptions(currentProvider ?? $selectedAuthProviderStore, mode, restrictTo),
    );
    let showAllOptions = $derived(
        (currentProvider ?? $selectedAuthProviderStore) === undefined ||
            showMore ||
            mode === "signup",
    );
    $effect(() => {
        const invalid = !isEmailValid(email);
        if (emailInvalid !== invalid) {
            emailInvalid = invalid;
        }
    });
</script>

<Container gap={"lg"} direction={"vertical"}>
    {#each options as provider, i}
        {#if showAllOptions || i === 0}
            <Container
                supplementalClass={`option ${
                    showAllOptions && options.length > 1 && i === 0 ? "separate" : ""
                }`}>
                {#if provider === AuthProvider.EMAIL}
                    <Form onSubmit={() => onLogin(provider)}>
                        <Container gap={"lg"} crossAxisAlignment={"center"}>
                            <Container width={"fill"}>
                                <Input
                                    bind:value={email}
                                    minlength={10}
                                    maxlength={200}
                                    placeholder={interpolate(
                                        $_,
                                        i18nKey(
                                            mode === "signin"
                                                ? "loginDialog.signinEmailPlaceholder"
                                                : "loginDialog.signupEmailPlaceholder",
                                        ),
                                    )} />
                            </Container>
                            <Container
                                width={"hug"}
                                onClick={emailInvalid ? undefined : () => onLogin(provider)}>
                                <SendIcon size={"1.5em"} />
                            </Container>
                        </Container>
                    </Form>
                {:else}
                    <SignInOption
                        hollow={provider !== AuthProvider.PASSKEY}
                        name={i18nKey(
                            mode === "signin" ? "loginDialog.signinWith" : "loginDialog.signupWith",
                            { provider: providerName(provider) },
                        )}
                        onClick={() => onLogin(provider)} />
                {/if}
            </Container>
        {/if}
    {/each}

    {#if !showAllOptions && options.length > 1}
        <Container mainAxisAlignment={"center"} onClick={() => (showMore = true)}>
            <Body width={"hug"} colour={"secondary"}>
                <Translatable resourceKey={i18nKey("loginDialog.showMore")} />
            </Body>
        </Container>
    {/if}
</Container>
