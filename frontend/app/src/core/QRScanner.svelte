<!-- Reads a QR code through the camera: the back camera's frames are drawn to a canvas, decoded by
     jsqr-es6 (loaded when scanning starts), and the first code found is handed to onData with its
     outline drawn. Every tree's scanner is this: the desktop and mobile wrappers frame it, the web
     wallet's Send shows it in a dialog. The camera stops when it's destroyed. -->
<script lang="ts">
    import type { Point } from "jsqr-es6/dist/locator";
    import { onMount } from "svelte";

    interface Props {
        /** Start scanning as soon as it shows; otherwise call scan(). */
        autoscan?: boolean;
        onData: (data: string) => void;
        /** The camera couldn't be used (declined, or none), or the decoder didn't load. */
        onError?: () => void;
    }

    let { autoscan = false, onData, onError }: Props = $props();

    let jsQR: typeof import("jsqr-es6").default | undefined;
    let canvasElement: HTMLCanvasElement | undefined = $state();
    let destroyed = false;
    let stream: MediaStream | undefined;
    let canvas = $derived(canvasElement?.getContext("2d"));

    onMount(() => {
        if (autoscan) scan();
        return () => {
            if (stream !== undefined) {
                for (const track of stream.getTracks()) {
                    track.stop();
                    stream.removeTrack(track);
                }
            }
            destroyed = true;
        };
    });

    export function scan(): void {
        navigator.mediaDevices
            .getUserMedia({ video: { facingMode: "environment" } })
            .then((s) => {
                if (destroyed) {
                    s.getTracks().forEach((t) => t.stop());
                    return;
                }
                console.debug("QR: camera stream obtained");
                stream = new MediaStream(s.getVideoTracks());
                const video = document.createElement("video");
                video.srcObject = stream;
                video.setAttribute("playsinline", "true");
                video.setAttribute("muted", "true");
                console.debug("QR: about to play video");
                video
                    .play()
                    .then(() => {
                        console.debug("QR: video play promise resolved");
                        return import("jsqr-es6");
                    })
                    .then((m) => {
                        jsQR = m.default;
                        requestAnimationFrame(() => checkResult(video));
                    })
                    .catch((err) => {
                        console.debug("QR: error playing video or loading decoder", err);
                        onError?.();
                    });
            })
            .catch((err) => {
                console.debug("QR: camera access declined", err);
                onError?.();
            });
    }

    function drawLine(canvas: CanvasRenderingContext2D, begin: Point, end: Point) {
        canvas.beginPath();
        canvas.moveTo(begin.x, begin.y);
        canvas.lineTo(end.x, end.y);
        canvas.lineWidth = 4;
        canvas.strokeStyle = "hotpink";
        canvas.stroke();
    }

    function checkResult(video: HTMLVideoElement) {
        if (destroyed) return;

        try {
            if (video.readyState === video.HAVE_ENOUGH_DATA && canvasElement && canvas) {
                console.debug("QR: checking for QR code");
                canvasElement.hidden = false;
                canvasElement.height = video.videoHeight;
                canvasElement.width = video.videoWidth;
                canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
                const imageData = canvas.getImageData(
                    0,
                    0,
                    canvasElement.width,
                    canvasElement.height,
                );
                const code = jsQR?.(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "dontInvert",
                });
                if (code) {
                    drawLine(canvas, code.location.topLeftCorner, code.location.topRightCorner);
                    drawLine(canvas, code.location.topRightCorner, code.location.bottomRightCorner);
                    drawLine(
                        canvas,
                        code.location.bottomRightCorner,
                        code.location.bottomLeftCorner,
                    );
                    drawLine(canvas, code.location.bottomLeftCorner, code.location.topLeftCorner);
                    onData(code.data);
                } else {
                    requestAnimationFrame(() => checkResult(video));
                }
            } else {
                requestAnimationFrame(() => checkResult(video));
            }
        } catch (err) {
            console.debug("QR: error checking for QR code: ", err);
        }
    }
</script>

<canvas class="qr-scanner" bind:this={canvasElement} hidden></canvas>

<style>
    .qr-scanner {
        display: block;
        max-width: 100%;
        max-height: var(--qr-scanner-max-height, none);
        object-fit: cover;
    }
</style>
