<script lang="ts">
    import { onMount } from "svelte";
    import Overlay from "./Overlay.svelte";
    import ModalContent from "./ModalContent.svelte";
    import Button from "./Button.svelte";
    import ButtonGroup from "./ButtonGroup.svelte";
    import Translatable from "./Translatable.svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import { mobileWidth } from "@src/stores/screenDimensions";

    const TOLERANCE = 0.1; // tolerance in radians

    interface Props {
        onClose: () => void;
        onResult: (e: MouseEvent, success: boolean) => void;
        imagePath?: string;
    }

    let { onClose, onResult, imagePath = "/assets/robot.svg" }: Props = $props();

    let leftImage: HTMLImageElement;
    let targetRotation: number = $state(0);
    let userRotation: number = $state(0);
    let leftImageTransform = $derived(`rotate(${userRotation}rad)`);
    let rightImageTransform = $derived(`rotate(${targetRotation}rad)`);
    let isDragging = $state(false);
    let startAngle = $state(0);
    let diff = $derived(Math.abs(userRotation - targetRotation));
    let correct = $derived(diff < TOLERANCE);

    onMount(() => {
        targetRotation = normaliseAngle(Math.random() * 2 * Math.PI);
        userRotation = normaliseAngle(Math.random() * 2 * Math.PI);
        document.addEventListener("mouseup", mouseUp);
        document.addEventListener("touchend", mouseUp);
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("touchmove", onMouseMove);

        return () => {
            document.removeEventListener("mouseup", mouseUp);
            document.removeEventListener("touchend", mouseUp);
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("touchmove", onMouseMove);
        };
    });

    function mouseUp() {
        isDragging = false;
    }

    function checkAnswer(e: MouseEvent) {
        onResult(e, correct);
    }

    function getMouseAngle(event: MouseEvent | TouchEvent): number {
        const rect = leftImage.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        let mouseX: number, mouseY: number;

        if (event instanceof MouseEvent) {
            mouseX = event.clientX;
            mouseY = event.clientY;
        } else if (event instanceof TouchEvent) {
            mouseX = event.touches[0].clientX;
            mouseY = event.touches[0].clientY;
        } else {
            return 0; // just in case
        }

        return Math.atan2(mouseY - centerY, mouseX - centerX);
    }

    function onMouseMove(e: MouseEvent | TouchEvent) {
        if (isDragging) {
            const currentMouseAngle = getMouseAngle(e);
            const angleDifference = currentMouseAngle - startAngle;
            userRotation = normaliseAngle(angleDifference);
        }
    }

    function onMouseDown(e: MouseEvent | TouchEvent) {
        isDragging = true;
        startAngle = normaliseAngle(getMouseAngle(e) - userRotation);
    }

    function normaliseAngle(angle: number): number {
        return ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    }
</script>

<Overlay dismissible {onClose}>
    <ModalContent closeIcon {onClose}>
        {#snippet header()}
            <div class="header">
                <Translatable resourceKey={i18nKey("rotationChallenge.title")}></Translatable>
            </div>
        {/snippet}
        {#snippet body()}
            <div class="image-container">
                <div class="left">
                    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                    <img
                        bind:this={leftImage}
                        class:dragging={isDragging}
                        style={`transform: ${leftImageTransform}`}
                        class="image handle"
                        src={imagePath}
                        onmousedown={onMouseDown}
                        ontouchstart={onMouseDown}
                        ondragstart={(e) => e.preventDefault()}
                        alt="Left" />
                </div>
                <div class="right">
                    <img
                        style={`--diff: ${diff}; transform: ${rightImageTransform}`}
                        class="image"
                        src={imagePath}
                        alt="Right" />
                </div>
            </div>
            <div class="info">
                <Translatable
                    resourceKey={i18nKey(
                        $mobileWidth ? "rotationChallenge.infoMobile" : "rotationChallenge.info",
                    )}></Translatable>
            </div>
        {/snippet}
        {#snippet footer()}
            <ButtonGroup align="center">
                <Button on:click={checkAnswer}>Check</Button>
            </ButtonGroup>
        {/snippet}
    </ModalContent>
</Overlay>

<style lang="scss">
    .image-container {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: $sp6;
        position: relative;
        margin-bottom: $sp3;

        @include mobile() {
            gap: $sp5;
            flex-direction: column;
        }
    }

    .left img {
        cursor: grab;
        user-select: none;

        &.dragging {
            cursor: grabbing;
        }
    }

    .right img {
        $pi: 3.14159265359;
        filter: saturate(calc(1 - (var(--diff) / $pi)));
    }

    .image {
        width: 200px;
        height: auto;
        text-align: center;

        @include mobile() {
            width: 160px;
        }
    }

    .handle {
        cursor: pointer;
    }

    .info {
        margin-top: $sp4;
        @include font(light, normal, fs-80);
        text-align: center;
        padding: 0 $sp4;
    }

    .header {
        text-align: center;
    }
</style>
