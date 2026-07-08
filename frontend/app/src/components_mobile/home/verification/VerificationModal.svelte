<script lang="ts">
    import {
        Body,
        BodySmall,
        ColourVars,
        Column,
        CommonButton,
        Container,
        Row,
        Sheet,
        Subtitle,
        Switch,
    } from "component-lib";
    import { type OpenChat } from "openchat-client";
    import { getContext, onDestroy } from "svelte";
    import AccountCheck from "svelte-material-icons/AccountCheck.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { HumanVerificationMachine } from "../../../utils/humanVerification/machine.svelte";
    import { msToHours } from "../../../utils/time";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import FancyLoader from "../../icons/FancyLoader.svelte";
    import Translatable from "../../Translatable.svelte";
    import VerificationDebugOverlay from "./VerificationDebugOverlay.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        onClose: () => void;
        onSuccess: () => void;
    }

    let { onClose, onSuccess }: Props = $props();

    const machine = new HumanVerificationMachine(client);
    const debug = localStorage.getItem("openchat_verification_debug") === "true";

    let consented = $state(false);
    let videoEl: HTMLVideoElement | undefined = $state(undefined);

    $effect(() => {
        if (videoEl !== undefined) {
            machine.attachVideo(videoEl);
        }
    });

    onDestroy(() => machine.destroy());

    const showCamera = $derived(
        machine.state.kind === "framing" ||
            machine.state.kind === "challenge" ||
            machine.state.kind === "loading_detector" ||
            machine.state.kind === "starting_session" ||
            machine.state.kind === "requesting_camera" ||
            machine.state.kind === "uploading",
    );

    const busyStates: Record<string, string> = {
        requesting_camera: "human.verification.requestingCamera",
        loading_detector: "human.verification.loadingDetector",
        starting_session: "human.verification.startingSession",
        uploading: "human.verification.uploading",
    };

    const remainingSeconds = $derived(
        machine.remainingMs !== undefined ? Math.ceil(machine.remainingMs / 1000) : undefined,
    );

    function prompt(): string {
        const state = machine.state;
        if (state.kind === "framing") {
            return "human.verification.framing";
        }
        if (state.kind === "challenge") {
            return `human.verification.pose.${state.step}`;
        }
        return "";
    }
</script>

<Sheet>
    <Column gap={"xl"} padding={"xl"}>
        <Row crossAxisAlignment={"center"} gap={"sm"}>
            <AccountCheck size={"1.5rem"} color={ColourVars.textPrimary} />
            <Subtitle fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("human.verification.title")} />
            </Subtitle>
        </Row>
        <Column gap={"md"}>
            {#if machine.state.kind === "consent"}
                <Body fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("human.verification.consentTitle")} />
                </Body>
                <Body>
                    <Translatable resourceKey={i18nKey("human.verification.consentBody")} />
                </Body>
                <BodySmall>
                    <Translatable resourceKey={i18nKey("human.verification.consentPoint1")} />
                </BodySmall>
                <BodySmall>
                    <Translatable resourceKey={i18nKey("human.verification.consentPoint2")} />
                </BodySmall>
                <BodySmall>
                    <Translatable resourceKey={i18nKey("human.verification.consentPoint3")} />
                </BodySmall>
                <Row crossAxisAlignment={"center"} gap={"md"}>
                    <Switch bind:checked={consented} />
                    <BodySmall>
                        <Translatable
                            resourceKey={i18nKey("human.verification.consentCheckbox")} />
                    </BodySmall>
                </Row>
            {:else if showCamera}
                <div class="camera">
                    <!-- svelte-ignore a11y_media_has_caption -->
                    <video class="preview" playsinline autoplay muted bind:this={videoEl}></video>
                    <div class="oval"></div>
                    {#if debug}
                        <VerificationDebugOverlay pose={machine.pose} />
                    {/if}
                    {#if machine.state.kind === "challenge" && machine.challenge !== undefined}
                        <div class="progress">
                            <Translatable
                                resourceKey={i18nKey("human.verification.stepProgress", {
                                    step: machine.state.stepIndex + 1,
                                    total: machine.challenge.steps.length,
                                })} />
                            {#if remainingSeconds !== undefined}
                                <span class="countdown">{remainingSeconds}s</span>
                            {/if}
                        </div>
                    {/if}
                    {#if busyStates[machine.state.kind] !== undefined}
                        <div class="status">
                            <Translatable resourceKey={i18nKey(busyStates[machine.state.kind])} />
                        </div>
                    {:else if prompt() !== ""}
                        <div class="status">
                            <Translatable resourceKey={i18nKey(prompt())} />
                        </div>
                    {/if}
                </div>
                {#if machine.degraded && machine.state.kind === "framing"}
                    <BodySmall>
                        <Translatable resourceKey={i18nKey("human.verification.manualIntro")} />
                    </BodySmall>
                {/if}
                {#if machine.challenge?.isRetryRound}
                    <BodySmall>
                        <Translatable resourceKey={i18nKey("human.verification.retryRound")} />
                    </BodySmall>
                {/if}
            {:else if machine.state.kind === "processing"}
                <div class="loader"><FancyLoader /></div>
                {#if machine.state.queuePosition !== undefined}
                    <Body>
                        <Translatable
                            resourceKey={i18nKey("human.verification.queued", {
                                position: machine.state.queuePosition,
                            })} />
                    </Body>
                {:else}
                    <Body>
                        <Translatable resourceKey={i18nKey("human.verification.processing")} />
                    </Body>
                {/if}
            {:else if machine.state.kind === "success"}
                <Body>
                    <Translatable resourceKey={i18nKey("human.verification.success")} />
                </Body>
            {:else if machine.state.kind === "already_verified"}
                <Body>
                    <Translatable resourceKey={i18nKey("human.verification.alreadyVerified")} />
                </Body>
            {:else if machine.state.kind === "retry_offered"}
                <Body>
                    <Translatable resourceKey={i18nKey("human.verification.retryOffered")} />
                </Body>
                <BodySmall>
                    <Translatable resourceKey={i18nKey("human.verification.retryTips")} />
                </BodySmall>
            {:else if machine.state.kind === "failed"}
                <Body>
                    <ErrorMessage>
                        {#if machine.state.reason === "not_unique"}
                            <Translatable resourceKey={i18nKey("human.verification.failed")} />
                        {:else if machine.state.reason === "no_face_detected"}
                            <Translatable
                                resourceKey={i18nKey("human.verification.failedNoFace")} />
                        {:else}
                            <Translatable
                                resourceKey={i18nKey("human.verification.failedChallenge")} />
                        {/if}
                    </ErrorMessage>
                </Body>
            {:else if machine.state.kind === "rate_limited"}
                <Body>
                    <Translatable
                        resourceKey={i18nKey("human.verification.rateLimited", {
                            duration: `${Math.max(
                                1,
                                msToHours(Number(machine.state.nextAttemptAt) - Date.now()),
                            )}h`,
                        })} />
                </Body>
            {:else if machine.state.kind === "busy"}
                <Body>
                    <Translatable resourceKey={i18nKey("human.verification.busy")} />
                </Body>
            {:else if machine.state.kind === "camera_denied"}
                <Body>
                    <ErrorMessage>
                        <Translatable resourceKey={i18nKey("human.verification.cameraDenied")} />
                    </ErrorMessage>
                </Body>
            {:else if machine.state.kind === "unsupported"}
                <Body>
                    <ErrorMessage>
                        <Translatable resourceKey={i18nKey("human.verification.unsupported")} />
                    </ErrorMessage>
                </Body>
            {:else if machine.state.kind === "expired"}
                <Body>
                    <ErrorMessage>
                        <Translatable resourceKey={i18nKey("human.verification.expired")} />
                    </ErrorMessage>
                </Body>
            {:else if machine.state.kind === "error"}
                <Body>
                    <ErrorMessage>
                        <Translatable resourceKey={i18nKey("human.verification.error")} />
                    </ErrorMessage>
                </Body>
            {/if}
        </Column>

        <Container mainAxisAlignment={"end"} gap={"sm"} crossAxisAlignment={"end"}>
            {#if machine.state.kind === "consent"}
                <CommonButton onClick={onClose} size={"small_text"}>
                    <Translatable resourceKey={i18nKey("cancel")} />
                </CommonButton>
                <CommonButton
                    disabled={!consented}
                    onClick={() => machine.start()}
                    size={"medium"}
                    mode={"active"}>
                    <Translatable resourceKey={i18nKey("human.verification.start")} />
                </CommonButton>
            {:else if machine.state.kind === "success" || machine.state.kind === "already_verified"}
                <CommonButton onClick={onSuccess} size={"medium"} mode={"active"}>
                    <Translatable resourceKey={i18nKey("human.verification.done")} />
                </CommonButton>
            {:else if machine.state.kind === "retry_offered"}
                <CommonButton onClick={onClose} size={"small_text"}>
                    <Translatable resourceKey={i18nKey("cancel")} />
                </CommonButton>
                <CommonButton onClick={() => machine.retry()} size={"medium"} mode={"active"}>
                    <Translatable resourceKey={i18nKey("human.verification.oneMoreTake")} />
                </CommonButton>
            {:else if machine.state.kind === "expired" || machine.state.kind === "error"}
                <CommonButton onClick={onClose} size={"small_text"}>
                    <Translatable resourceKey={i18nKey("cancel")} />
                </CommonButton>
                <CommonButton onClick={() => machine.restart()} size={"medium"} mode={"active"}>
                    <Translatable resourceKey={i18nKey("human.verification.tryAgain")} />
                </CommonButton>
            {:else if machine.degraded && machine.state.kind === "framing"}
                <CommonButton onClick={onClose} size={"small_text"}>
                    <Translatable resourceKey={i18nKey("cancel")} />
                </CommonButton>
                <CommonButton onClick={() => machine.manualReady()} size={"medium"} mode={"active"}>
                    <Translatable resourceKey={i18nKey("human.verification.manualReady")} />
                </CommonButton>
            {:else if machine.degraded && machine.state.kind === "challenge"}
                <CommonButton onClick={onClose} size={"small_text"}>
                    <Translatable resourceKey={i18nKey("cancel")} />
                </CommonButton>
                <CommonButton
                    onClick={() => machine.manualCapture()}
                    size={"medium"}
                    mode={"active"}>
                    <Translatable resourceKey={i18nKey("human.verification.capture")} />
                </CommonButton>
            {:else}
                <CommonButton onClick={onClose} size={"small_text"}>
                    <Translatable resourceKey={i18nKey("cancel")} />
                </CommonButton>
            {/if}
        </Container>
    </Column>
</Sheet>

<style lang="scss">
    .camera {
        position: relative;
        width: 100%;
        aspect-ratio: 3 / 4;
        border-radius: $sp3;
        overflow: hidden;
        background-color: #000;
    }

    .preview {
        width: 100%;
        height: 100%;
        object-fit: cover;
        // preview is mirrored for the user; captured frames are not
        transform: scaleX(-1);
    }

    .oval {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 65%;
        height: 60%;
        transform: translate(-50%, -50%);
        border: 3px dashed rgba(255, 255, 255, 0.8);
        border-radius: 50%;
        pointer-events: none;
    }

    .status {
        position: absolute;
        bottom: $sp3;
        left: 50%;
        transform: translateX(-50%);
        white-space: nowrap;
        padding: $sp2 $sp4;
        background-color: rgba(0, 0, 0, 0.6);
        color: #fff;
        border-radius: $sp5;
        @include font(bold, normal, fs-100);
    }

    .progress {
        position: absolute;
        top: $sp3;
        right: $sp3;
        padding: $sp2 $sp3;
        background-color: rgba(0, 0, 0, 0.6);
        color: #fff;
        border-radius: $sp2;
        @include font(book, normal, fs-80);

        .countdown {
            margin-left: $sp3;
        }
    }

    .loader {
        width: 100px;
        margin: $sp6 auto;
    }
</style>
