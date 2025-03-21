<script lang="ts">
    import Overlay from "./Overlay.svelte";
    import Button from "./Button.svelte";
    import ButtonGroup from "./ButtonGroup.svelte";
    import ModalContent from "./ModalContentLegacy.svelte";
    import { createEventDispatcher } from "svelte";
    import Cropper from "svelte-easy-crop";
    import type { CropData } from "svelte-easy-crop";
    import ChooseImage from "./icons/ChooseImage.svelte";
    import { i18nKey } from "../i18n/i18n";
    import Translatable from "./Translatable.svelte";
    const dispatch = createEventDispatcher();

    export let image: string | null | undefined;
    export let disabled = false;
    export let size: Size = "large";
    export let mode: Mode = "avatar";
    export let overlayIcon = false;

    type Dimensions = { width: number; height: number };
    type Mode = "banner" | "avatar";
    type Size = "small" | "medium" | "large";
    type CropShape = "round" | "rect";

    let fileinput: HTMLInputElement;
    let avatar: string | null | undefined;
    let originalImage = new Image();
    let showModal = false;
    $: SAVE_DIMS = getSaveDimensions(mode);
    $: CROP_SHAPE = mode === "avatar" ? "round" : ("rect" as CropShape);
    let cropData: CropData | undefined = undefined;

    $: width = 0;
    $: height = width / (600 / 300);
    $: iconSize = getIconSize(size);

    function getSaveDimensions(mode: Mode): Dimensions {
        switch (mode) {
            case "avatar":
                return { width: 150, height: 150 };
            case "banner":
                return { width: 600, height: 300 };
        }
    }

    function getIconSize(size: Size): string {
        switch (size) {
            case "large":
                return "3em";
            case "medium":
                return "2em";
            case "small":
                return "1em";
        }
    }

    export function addPhoto() {
        if (!disabled) {
            fileinput.click();
        }
    }

    function onFileSelected(e: { currentTarget: HTMLInputElement }) {
        if (e.currentTarget) {
            const target = e.currentTarget as HTMLInputElement;
            if (target.files) {
                const image = target.files[0];
                let reader = new FileReader();
                reader.readAsDataURL(image);
                reader.onload = (e) => {
                    avatar = e?.target?.result as string;
                    originalImage.src = avatar;
                    showModal = true;
                    fileinput.value = "";
                };
            }
        }
    }

    function cropImage() {
        if (!cropData || !originalImage) return;

        const {
            pixels: { x, y, width, height },
        } = cropData;

        const canvas: HTMLCanvasElement = document.createElement("canvas");
        canvas.width = SAVE_DIMS.width;
        canvas.height = SAVE_DIMS.height;
        canvas
            .getContext("2d")
            ?.drawImage(
                originalImage,
                x,
                y,
                width,
                height,
                0,
                0,
                SAVE_DIMS.width,
                SAVE_DIMS.height,
            );

        canvas.toBlob(async (blob: Blob | null) => {
            if (blob) {
                const array = await blob.arrayBuffer();
                const data = new Uint8Array(array);
                image = canvas.toDataURL("image/jpg");
                showModal = false;
                console.log("image size: ", data.length);
                dispatch("imageSelected", { url: image, data });
            }
        }, "image/jpg");
    }

    function onCrop(ev: CustomEvent<CropData>): void {
        cropData = ev.detail;
    }
</script>

{#if showModal}
    <Overlay>
        <ModalContent fill>
            <span slot="header">Crop image</span>
            <span slot="body">
                <div class="cropper">
                    <Cropper
                        image={avatar}
                        on:cropcomplete={onCrop}
                        crop={{ x: 0, y: 0 }}
                        aspect={mode === "banner" ? SAVE_DIMS.width / SAVE_DIMS.height : 1}
                        cropShape={CROP_SHAPE} />
                </div>
            </span>
            <span slot="footer">
                <ButtonGroup>
                    <Button tiny secondary on:click={() => (showModal = false)}
                        ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                    <Button tiny on:click={cropImage}
                        ><Translatable resourceKey={i18nKey("apply")} /></Button>
                </ButtonGroup>
            </span>
        </ModalContent>
    </Overlay>
{/if}

<input
    hidden
    type="file"
    accept=".jpg, .jpeg, .png, .gif, .svg"
    on:change={onFileSelected}
    bind:this={fileinput} />

{#if mode === "banner"}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div
        bind:clientWidth={width}
        class={`photo-section ${mode}`}
        on:click={addPhoto}
        style={image
            ? `height: ${height}px; background-image: url(${image})`
            : `height: ${height}px`}>
        <div class={`photo-icon ${size} ${mode}`}>
            <ChooseImage size={iconSize} color={image ? "#fff" : "var(--icon-txt)"} />
        </div>
    </div>
{:else}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class={`photo-section ${mode}`} on:click={addPhoto}>
        <div class={`photo-icon ${size} ${mode}`}>
            {#if image}
                <div class="avatar" style={`background-image: url(${image})`} />
                {#if overlayIcon}
                    <div class="overlay">
                        <ChooseImage size={iconSize} color={"#fff"} />
                    </div>
                {/if}
            {:else}
                <ChooseImage size={iconSize} color={"var(--icon-txt)"} />
            {/if}
        </div>
    </div>
{/if}

<style lang="scss">
    .cropper {
        position: relative;
        height: 400px;
        width: 100%;
    }

    .photo-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: pointer;

        &.banner {
            background-color: var(--input-bg);
            background-size: cover;
            height: 200px;
        }
    }

    .overlay {
        position: absolute;
    }

    .photo-icon {
        border-radius: var(--avatar-rd);
        display: flex;
        justify-content: center;
        align-items: center;
        position: relative;

        &.avatar {
            background-color: var(--input-bg);
        }

        &.large {
            width: toRem(150);
            height: toRem(150);
        }
        &.medium {
            width: toRem(100);
            height: toRem(100);
        }
        &.small {
            width: toRem(48);
            height: toRem(48);
        }

        .avatar {
            width: 100%;
            height: 100%;
            background-size: cover;
            border-radius: var(--avatar-rd);
        }
    }
</style>
