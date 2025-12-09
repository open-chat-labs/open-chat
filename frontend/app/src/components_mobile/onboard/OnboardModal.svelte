<script lang="ts">
    import { i18nKey, interpolate } from "@src/i18n/i18n";
    import {
        Body,
        BodySmall,
        Button,
        CommonButton,
        Container,
        H1,
        Subtitle,
        Title,
    } from "component-lib";
    import { OpenChat, type CreatedUser } from "openchat-client";
    import { ErrorCode } from "openchat-shared";
    import page from "page";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import ChevronLeft from "svelte-material-icons/ChevronLeft.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import Markdown from "../home/Markdown.svelte";
    import Translatable from "../Translatable.svelte";
    import SignUp from "./SignUp.svelte";

    const ALC_LENGTH = 6;

    const client = getContext<OpenChat>("client");

    type Step = "choose-auth" | "new-user" | "one-time-password";
    let step: Step = $state("choose-auth");
    let accountLinkingCode = $state("");
    let alcInput: HTMLInputElement | undefined = $state(undefined);
    let alcValid = $derived(accountLinkingCode.length === 6);
    let linkingInProgress = $state(false);
    let error: string | undefined = $state(undefined);
    let signUpError: string | undefined = $state(undefined);

    onMount(() => {
        document.body.classList.add("onboarding");
        return () => {
            document.body.classList.remove("onboarding");
        };
    });

    function signIn() {
        (client.isNativeAndroid()
            ? client.signInWithAndroidWebAuthn()
            : client.signInWithWebAuthn()
        ).catch(async (e) => {
            if ("AUTH_FAILED" === e) {
                error = "native.auth.error";
                console.error("Auth error: ", e);
            } else {
                // Passkey either not found, or user cancelled auth request
                step = "one-time-password";
            }
        });
    }

    function signUp() {
        step = "new-user";
    }

    function errorCodeToi18nKey(code: number | string): string {
        switch (code) {
            case ErrorCode.AlreadyRegistered:
                return "alreadyRegistered";
            case ErrorCode.LinkingCodeNotFound:
                return "linkingCodeNotFound";
            case ErrorCode.MaxLinkedIdentitiesLimitReached:
                return "maxLinkedIdentitiesLimitReached";
            default:
                return "string" === typeof code ? code : "default";
        }
    }

    function linkAccount() {
        if (!linkingInProgress && accountLinkingCode.length === ALC_LENGTH) {
            linkingInProgress = true;
            error = undefined;
            client.linkAccountsWithAndroidWebAuthn(accountLinkingCode).catch((err) => {
                console.error(err);
                linkingInProgress = false;
                if (err && "object" === typeof err && "code" in err) {
                    error = errorCodeToi18nKey(err.code);
                } else {
                    error = "default";
                }
            });
        } else {
            error = "codeInvalid";
        }
    }

    function onCreatedUser(user: CreatedUser) {
        client.onRegisteredUser(user);
    }

    function explore() {
        client.updateIdentityState({ kind: "anon" });
        page("/communities");
    }
</script>

{#snippet backButton()}
    <Container padding={["zero", "lg"]} direction={"vertical"}>
        <CommonButton onClick={() => (step = "choose-auth")} mode={"active"} size={"small_text"}>
            {#snippet icon(color, size)}
                <ChevronLeft {color} {size} />
            {/snippet}
            <Translatable resourceKey={i18nKey("back")} />
        </CommonButton>
    </Container>
{/snippet}

{#snippet choosePath()}
    <Container padding={["zero", "xxl"]} direction={"vertical"}>
        <H1><Translatable resourceKey={i18nKey("Fully featured.")} /></H1>
        <H1><Translatable resourceKey={i18nKey("Fully yours.")} /></H1>
    </Container>
    <Container gap={"md"} padding={["zero", "xxl"]} direction={"vertical"}>
        <Button onClick={explore} secondary>
            <Translatable resourceKey={i18nKey("Explore communities")} />
        </Button>
        <BodySmall colour={"textSecondary"} align={"center"} width={"hug"} fontWeight={"bold"}>
            <Translatable
                resourceKey={i18nKey(
                    "Preview OpenChat communities without joining. You will need an account to gain access.",
                )} />
        </BodySmall>
    </Container>
    <Container
        crossAxisAlignment={"center"}
        mainAxisAlignment={"center"}
        gap={"md"}
        padding={["zero", "xxl"]}>
        <div class="line"></div>
        <Body colour={"textSecondary"} align={"center"} width={"hug"} fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("or join")} />
        </Body>
        <div class="line"></div>
    </Container>
    <Container
        crossAxisAlignment={"center"}
        gap={"md"}
        padding={["zero", "xxl"]}
        direction={"vertical"}>
        <Button onClick={signIn}>
            <Translatable resourceKey={i18nKey("I'm an existing user")} />
        </Button>
        <Button onClick={signUp} secondary>
            <Translatable resourceKey={i18nKey("Create new account")} />
        </Button>
        <BodySmall colour={"textSecondary"} align={"center"} width={"hug"} fontWeight={"bold"}>
            <Markdown
                text={interpolate(
                    $_,
                    i18nKey(
                        "OpenChat uses *Passkeys* to secure accounts.\n Visit [oc.app web](https://oc.app) to found out more.",
                    ),
                )}></Markdown>
        </BodySmall>
    </Container>
{/snippet}

{#snippet newUserView()}
    {@render backButton()}

    <Container padding={["zero", "xxl"]} direction={"vertical"}>
        <H1><Translatable resourceKey={i18nKey("Create new account")} /></H1>
        <Title fontWeight={"bold"} colour={"primary"}
            ><Translatable resourceKey={i18nKey("Welcome aboard!")} /></Title>
    </Container>

    <Container padding={["zero", "xxl"]} direction={"vertical"}>
        <Subtitle fontWeight={"bold"} colour={"textSecondary"}>
            <Translatable
                resourceKey={i18nKey(
                    "We're really glad you're here. You're joining a safe, private space built and shaped by its community.",
                )} />
        </Subtitle>
    </Container>

    <Container padding={["zero", "lg"]} direction={"vertical"}>
        <SignUp {onCreatedUser} bind:error={signUpError} />
    </Container>
{/snippet}

{#snippet existingUserView()}
    {@render backButton()}

    <Container padding={["zero", "xxl"]} direction={"vertical"}>
        <H1><Translatable resourceKey={i18nKey("Existing user")} /></H1>
        <Title fontWeight={"bold"} colour={"primary"}
            ><Translatable resourceKey={i18nKey("Welcome back!")} /></Title>
    </Container>

    <Container gap={"sm"} padding={["zero", "xxl"]} direction={"vertical"}>
        <Subtitle fontWeight={"bold"} colour={"textSecondary"}>
            <Translatable
                resourceKey={i18nKey(
                    "Let's reconnect your account so you can continue exactly where you left off.",
                )} />
        </Subtitle>
        <BodySmall colour={"textTertiary"}>
            <Translatable
                resourceKey={i18nKey(
                    "If you expected to use an existing passkey, it may not be available on this device at the moment.",
                )} />
        </BodySmall>
    </Container>

    <Container padding={["zero", "xxl"]} direction={"vertical"}>
        <div class="alc-container">
            <input
                class="alc-input"
                bind:value={accountLinkingCode}
                bind:this={alcInput}
                type="text"
                maxlength="6"
                pattern="[a-zA-Z0-9]{6}" />
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="alc" onclick={() => alcInput?.focus()}>
                {#each [...Array(6).keys()] as key}
                    <div class="char {key === accountLinkingCode.length ? 'current' : ''}">
                        <span class="value">{accountLinkingCode[key] || ""}</span>
                    </div>
                {/each}
            </div>
        </div>
        <Container direction={"vertical"} gap={"xxl"}>
            <BodySmall width={"hug"} align={"center"} colour={"textSecondary"}>
                <Translatable resourceKey={i18nKey("native.auth.linkAccount.note")} />
            </BodySmall>
            <Button
                loading={linkingInProgress}
                disabled={linkingInProgress || !alcValid}
                onClick={linkAccount}>
                <Translatable resourceKey={i18nKey("Link with existing account")} />
            </Button>
        </Container>
    </Container>
{/snippet}

<Container gap={"xl"} direction={"vertical"}>
    <Container
        supplementalClass={"login_mockup"}
        height={{ size: step === "choose-auth" ? "23rem" : "11rem" }}
        backgroundImage={"/assets/login_mockup.svg"}>
        <span></span>
    </Container>
    {#if step === "choose-auth"}
        {@render choosePath()}
    {:else if step === "new-user"}
        {@render newUserView()}
    {:else if step === "one-time-password"}
        {@render existingUserView()}
    {/if}
    {#if error !== undefined}
        <Container gap={"md"} padding={["zero", "xxl"]} direction={"vertical"}>
            <ErrorMessage>
                <Translatable resourceKey={i18nKey(error)} />
            </ErrorMessage>
        </Container>
    {/if}
</Container>

<style lang="scss">
    :global(.container.login_mockup) {
        background-position: bottom !important;
    }

    .line {
        height: 6px;
        width: 100%;
        border-radius: var(--rad-xl);
        background-color: var(--background-2);
    }

    .alc-container {
        width: 100%;
        .alc {
            display: flex;
            padding: var(--sp-xxl) 0 var(--sp-sm) 0;
            gap: $sp4;
            justify-content: center;

            .char {
                display: flex;
                flex: 1;
                height: 7rem;
                justify-content: end;
                flex-direction: column;
                align-items: center;
                @include font(light, normal, fs-220);
                position: relative;
                overflow: hidden;

                &:after {
                    content: "";
                    display: block;
                    width: 100%;
                    height: 0.25rem;
                    border-radius: $sp2;
                    background-color: var(--primary);
                }
            }
        }

        .alc-input {
            height: 0;
            padding: 0;
            border: none;
            position: absolute;
            left: -2000px;
            &:focus + .alc > .char.current {
                &:before {
                    content: "";
                    display: block;
                    width: 1rem;
                    height: 1rem;
                    background-color: var(--primary);
                    position: absolute;
                    top: -0.75rem;
                    left: 50%;
                    transform: translateX(-50%) rotate(45deg);
                }
            }
        }
    }
</style>
