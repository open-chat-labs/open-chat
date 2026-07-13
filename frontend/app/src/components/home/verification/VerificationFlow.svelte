<script lang="ts">
    import { type OpenChat } from "@client";
    import { getContext, onDestroy } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { HumanVerificationMachine } from "../../../utils/humanVerification/machine.svelte";
    import { playCaptureTone } from "../../../utils/humanVerification/sound";
    import { msToHours } from "../../../utils/time";
    import AlertBox from "../../AlertBox.svelte";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Checkbox from "../../Checkbox.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import FancyLoader from "../../icons/FancyLoader.svelte";
    import Translatable from "../../Translatable.svelte";
    import VerificationDebugOverlay from "./VerificationDebugOverlay.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        onCancel: () => void;
        onSuccess: () => void;
    }

    let { onCancel, onSuccess }: Props = $props();

    const machine = new HumanVerificationMachine(client);
    const debug =
        import.meta.env.DEV && localStorage.getItem("openchat_verification_debug") === "true";

    let consented = $state(false);
    let videoEl: HTMLVideoElement | undefined | null = $state(undefined);
    let flash = $state(false);
    let lastCaptureCount = 0;

    $effect(() => {
        machine.attachVideo(videoEl);
    });

    // Green flash + happy tone each time a pose is captured
    $effect(() => {
        const count = machine.captureCount;
        if (count > lastCaptureCount) {
            lastCaptureCount = count;
            flash = true;
            playCaptureTone();
            setTimeout(() => (flash = false), 450);
        }
    });

    onDestroy(() => machine.destroy());

    const showCamera = $derived(
        machine.state.kind === "framing" ||
            machine.state.kind === "challenge" ||
            machine.state.kind === "loading_detector" ||
            machine.state.kind === "starting_session",
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
        <div class="body">
            {#if machine.state.kind === "consent"}
                <h4><Translatable resourceKey={i18nKey("human.verification.consentTitle")} /></h4>
                <p><Translatable resourceKey={i18nKey("human.verification.consentBody")} /></p>
                <ul>
                    <li><Translatable resourceKey={i18nKey("human.verification.consentPoint1")} /></li>
                    <li><Translatable resourceKey={i18nKey("human.verification.consentPoint2")} /></li>
                    <li><Translatable resourceKey={i18nKey("human.verification.consentPoint3")} /></li>
                </ul>
                <p>
                    <a href="/terms?section=12" target="_blank" rel="noreferrer">
                        <Translatable resourceKey={i18nKey("human.verification.consentTerms")} />
                    </a>
                </p>
                <AlertBox icon={false}>
                    <Checkbox
                        id="verification-consent"
                        label={i18nKey("human.verification.consentCheckbox")}
                        align={"start"}
                        bind:checked={consented}>
                        <Translatable
                            resourceKey={i18nKey("human.verification.consentCheckbox")} />
                    </Checkbox>
                </AlertBox>
            {:else if showCamera || machine.state.kind === "requesting_camera" || machine.state.kind === "uploading"}
                <div class="camera">
                    <!-- svelte-ignore a11y_media_has_caption -->
                    <video class="preview" playsinline autoplay muted bind:this={videoEl}></video>
                    <div class="oval" class:matched={machine.poseMatched} class:flash={flash}></div>
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
                    <p class="manual">
                        <Translatable resourceKey={i18nKey("human.verification.manualIntro")} />
                    </p>
                {/if}
                {#if machine.challenge?.isRetryRound}
                    <p class="manual">
                        <Translatable resourceKey={i18nKey("human.verification.retryRound")} />
                    </p>
                {/if}
            {:else if machine.state.kind === "processing"}
                <div class="loader"><FancyLoader /></div>
                <p class="centered">
                    {#if machine.state.queuePosition !== undefined}
                        <Translatable
                            resourceKey={i18nKey("human.verification.queued", {
                                position: machine.state.queuePosition,
                            })} />
                    {:else}
                        <Translatable resourceKey={i18nKey("human.verification.processing")} />
                    {/if}
                </p>
            {:else if machine.state.kind === "success"}
                <p><Translatable resourceKey={i18nKey("human.verification.success")} /></p>
            {:else if machine.state.kind === "already_verified"}
                <p><Translatable resourceKey={i18nKey("human.verification.alreadyVerified")} /></p>
            {:else if machine.state.kind === "retry_offered"}
                <p><Translatable resourceKey={i18nKey("human.verification.retryOffered")} /></p>
                <p class="manual">
                    <Translatable resourceKey={i18nKey("human.verification.retryTips")} />
                </p>
            {:else if machine.state.kind === "failed"}
                <ErrorMessage>
                    {#if machine.state.reason === "not_unique"}
                        <Translatable resourceKey={i18nKey("human.verification.failed")} />
                    {:else if machine.state.reason === "no_face_detected"}
                        <Translatable resourceKey={i18nKey("human.verification.failedNoFace")} />
                    {:else}
                        <Translatable
                            resourceKey={i18nKey("human.verification.failedChallenge")} />
                    {/if}
                </ErrorMessage>
            {:else if machine.state.kind === "rate_limited"}
                <p>
                    <Translatable
                        resourceKey={i18nKey("human.verification.rateLimited", {
                            duration: `${Math.max(
                                1,
                                msToHours(Number(machine.state.nextAttemptAt) - Date.now()),
                            )}h`,
                        })} />
                </p>
            {:else if machine.state.kind === "busy"}
                <p><Translatable resourceKey={i18nKey("human.verification.busy")} /></p>
            {:else if machine.state.kind === "camera_denied"}
                <ErrorMessage>
                    <Translatable resourceKey={i18nKey("human.verification.cameraDenied")} />
                </ErrorMessage>
            {:else if machine.state.kind === "unsupported"}
                <ErrorMessage>
                    <Translatable resourceKey={i18nKey("human.verification.unsupported")} />
                </ErrorMessage>
            {:else if machine.state.kind === "expired"}
                <ErrorMessage>
                    <Translatable resourceKey={i18nKey("human.verification.expired")} />
                </ErrorMessage>
            {:else if machine.state.kind === "error"}
                <ErrorMessage>
                    <Translatable resourceKey={i18nKey("human.verification.error")} />
                </ErrorMessage>
            {/if}
        </div>
    

        <div>
            <ButtonGroup>
                {#if machine.state.kind === "consent"}
                    <Button secondary onClick={onCancel}>
                        <Translatable resourceKey={i18nKey("cancel")} />
                    </Button>
                    <Button disabled={!consented} onClick={() => machine.start()}>
                        <Translatable resourceKey={i18nKey("human.verification.start")} />
                    </Button>
                {:else if machine.state.kind === "success" || machine.state.kind === "already_verified"}
                    <Button onClick={onSuccess}>
                        <Translatable resourceKey={i18nKey("human.verification.done")} />
                    </Button>
                {:else if machine.state.kind === "retry_offered"}
                    <Button secondary onClick={onCancel}>
                        <Translatable resourceKey={i18nKey("cancel")} />
                    </Button>
                    <Button onClick={() => machine.retry()}>
                        <Translatable resourceKey={i18nKey("human.verification.oneMoreTake")} />
                    </Button>
                {:else if machine.state.kind === "expired" || machine.state.kind === "error"}
                    <Button secondary onClick={onCancel}>
                        <Translatable resourceKey={i18nKey("cancel")} />
                    </Button>
                    <Button onClick={() => machine.restart()}>
                        <Translatable resourceKey={i18nKey("human.verification.tryAgain")} />
                    </Button>
                {:else if machine.degraded && machine.state.kind === "framing"}
                    <Button secondary onClick={onCancel}>
                        <Translatable resourceKey={i18nKey("cancel")} />
                    </Button>
                    <Button onClick={() => machine.manualReady()}>
                        <Translatable resourceKey={i18nKey("human.verification.manualReady")} />
                    </Button>
                {:else if machine.degraded && machine.state.kind === "challenge"}
                    <Button secondary onClick={onCancel}>
                        <Translatable resourceKey={i18nKey("cancel")} />
                    </Button>
                    <Button onClick={() => machine.manualCapture()}>
                        <Translatable resourceKey={i18nKey("human.verification.capture")} />
                    </Button>
                {:else}
                    <Button secondary onClick={onCancel}>
                        <Translatable resourceKey={i18nKey("cancel")} />
                    </Button>
                {/if}
            </ButtonGroup>
        </div>
    

<style lang="scss">
    .body {
        p,
        ul {
            margin-bottom: $sp4;
        }

        ul {
            padding-left: $sp5;
            list-style: disc;
            color: var(--txt-light);
            @include font(book, normal, fs-90);
        }
    }

    .camera {
        position: relative;
        width: 100%;
        aspect-ratio: 4 / 3;
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
        transition:
            border-color 200ms ease,
            box-shadow 200ms ease;

        &.matched {
            border-color: #34c759;
            border-style: solid;
        }

        &.flash {
            animation: capture-flash 450ms ease-out;
        }

        width: 55%;
        height: 80%;
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

    .manual {
        margin-top: $sp4;
        color: var(--txt-light);
        @include font(book, normal, fs-90);
    }

    .centered {
        text-align: center;
    }

    .loader {
        width: 100px;
        margin: $sp6 auto;
    }

    @keyframes capture-flash {
        0% {
            box-shadow: 0 0 0 0 rgba(52, 199, 89, 0.9);
            border-color: #34c759;
        }
        100% {
            box-shadow: 0 0 0 18px rgba(52, 199, 89, 0);
        }
    }
</style>
