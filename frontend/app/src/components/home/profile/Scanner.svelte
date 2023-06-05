<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import jsQR from "jsqr-es6";
    import type { Point } from "jsqr-es6/dist/locator";

    export let autoscan = false;

    const dispatch = createEventDispatcher();

    let canvasElement: HTMLCanvasElement;
    let destroyed = false;
    let stream: MediaStream | undefined;
    $: canvas = canvasElement?.getContext("2d");

    onMount(() => {
        if (autoscan) {
            scan();
        }
    });

    onMount(() => {
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

    export function scan() {
        navigator.mediaDevices
            .getUserMedia({ video: { facingMode: "environment" } })
            .then((s) => {
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
                        requestAnimationFrame(() => checkResult(video));
                    })
                    .catch((err) => {
                        console.debug("QR: error playing video", err);
                    });
            })
            .catch((err) => {
                console.debug("QR: camera access declined", err);
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
                    canvasElement.height
                );
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "dontInvert",
                });
                if (code) {
                    drawLine(canvas, code.location.topLeftCorner, code.location.topRightCorner);
                    drawLine(canvas, code.location.topRightCorner, code.location.bottomRightCorner);
                    drawLine(
                        canvas,
                        code.location.bottomRightCorner,
                        code.location.bottomLeftCorner
                    );
                    drawLine(canvas, code.location.bottomLeftCorner, code.location.topLeftCorner);
                    dispatch("data", code.data);
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

<canvas class="scanner" bind:this={canvasElement} hidden />

<style lang="scss">
    .scanner {
        margin-bottom: $sp4;
        border: 4px dashed var(--bd);
        border-radius: $sp4;

        @include mobile() {
            max-height: 300px;
            width: 100%;
            object-fit: cover;
        }
    }
</style>
