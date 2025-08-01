<script lang="ts">
    import type { Snippet } from "svelte";
    import type { CropData } from "svelte-easy-crop";
    import Cropper from "svelte-easy-crop";
    import { i18nKey } from "../i18n/i18n";
    import Button from "./Button.svelte";
    import ButtonGroup from "./ButtonGroup.svelte";
    import ModalContent from "./ModalContent.svelte";
    import Overlay from "./Overlay.svelte";
    import Translatable from "./Translatable.svelte";

    type OnChoosePhoto = () => void;

    interface Props {
        image: string | null | undefined;
        disabled?: boolean;
        mode?: Mode;
        onImageSelected: (args: { url: string; data: Uint8Array }) => void;
        children: Snippet<[OnChoosePhoto, number, number]>;
    }

    let {
        image = $bindable(),
        disabled = false,
        mode = "avatar",
        onImageSelected,
        children,
    }: Props = $props();

    type Dimensions = { width: number; height: number };
    type Mode = "banner" | "avatar" | "profile";
    type CropShape = "round" | "rect";

    let fileinput: HTMLInputElement;
    let selectedImage: string | null | undefined = $state();
    let originalImage = new Image();
    let showModal = $state(false);
    let cropData: CropData | undefined = undefined;

    function getSaveDimensions(mode: Mode): Dimensions {
        switch (mode) {
            case "avatar":
                return { width: 150, height: 150 };
            case "banner":
                return { width: 600, height: 300 };
            case "profile":
                return { width: 600, height: 800 };
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
                    selectedImage = e?.target?.result as string;
                    originalImage.src = selectedImage;
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
                onImageSelected({ url: image, data });
            }
        }, "image/jpg");
    }

    function onCrop(ev: CustomEvent<CropData>): void {
        cropData = ev.detail;
    }
    let SAVE_DIMS = $derived(getSaveDimensions(mode));
    let CROP_SHAPE = $derived(mode === "avatar" ? "round" : ("rect" as CropShape));
    let elementWidth = $state(0);
    let elementHeight = $derived(elementWidth / (SAVE_DIMS.width / SAVE_DIMS.height));
    let aspect = $derived(mode === "avatar" ? 1 : SAVE_DIMS.width / SAVE_DIMS.height);
</script>

{#if showModal}
    <Overlay>
        <ModalContent fill>
            {#snippet header()}
                Crop image
            {/snippet}
            {#snippet body()}
                <div class="cropper">
                    <Cropper
                        image={selectedImage}
                        on:cropcomplete={onCrop}
                        crop={{ x: 0, y: 0 }}
                        {aspect}
                        cropShape={CROP_SHAPE} />
                </div>
            {/snippet}
            {#snippet footer()}
                <ButtonGroup>
                    <Button tiny secondary onClick={() => (showModal = false)}
                        ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                    <Button tiny onClick={cropImage}
                        ><Translatable resourceKey={i18nKey("apply")} /></Button>
                </ButtonGroup>
            {/snippet}
        </ModalContent>
    </Overlay>
{/if}

<input
    hidden
    type="file"
    accept=".jpg, .jpeg, .png, .gif, .svg"
    onchange={onFileSelected}
    bind:this={fileinput} />

<div class="editable-image" bind:clientWidth={elementWidth}>
    {@render children(addPhoto, elementWidth, elementHeight)}
</div>

<style lang="scss">
    .cropper {
        position: relative;
        height: 400px;
        width: 100%;
    }
</style>
