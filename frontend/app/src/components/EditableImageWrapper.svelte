<script lang="ts">
    import type { Snippet } from "svelte";
    import type { OnCropCompleteEvent } from "svelte-easy-crop";
    import {
        AVATAR_SIZE,
        BANNER_SIZE,
        cropImage,
        PROFILE_BACKGROUND_SIZE,
        readImageFile,
        type CropSize,
    } from "@src/utils/imageCrop";
    import Cropper from "svelte-easy-crop";
    import { i18nKey } from "../i18n/i18n";
    import Button from "./Button.svelte";
    import ButtonGroup from "./ButtonGroup.svelte";
    import ModalContent from "./ModalContent.svelte";
    import Overlay from "./Overlay.svelte";
    import Translatable from "@shared_components/Translatable.svelte";

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

    type Mode = "banner" | "avatar" | "profile";
    type CropShape = "round" | "rect";

    let fileinput: HTMLInputElement;
    let selectedImage: string | undefined = $state();
    let showModal = $state(false);
    let cropData: OnCropCompleteEvent | undefined = undefined;

    function getSaveDimensions(mode: Mode): CropSize {
        switch (mode) {
            case "avatar":
                return AVATAR_SIZE;
            case "banner":
                return BANNER_SIZE;
            case "profile":
                return PROFILE_BACKGROUND_SIZE;
        }
    }

    export function addPhoto() {
        if (!disabled) {
            fileinput.click();
        }
    }

    async function onFileSelected(e: { currentTarget: HTMLInputElement }) {
        const file = e.currentTarget.files?.[0];
        e.currentTarget.value = "";
        if (file === undefined) return;
        selectedImage = await readImageFile(file);
        showModal = true;
    }

    async function applyCrop() {
        if (!cropData || selectedImage === undefined) return;
        const cropped = await cropImage(selectedImage, cropData.pixels, SAVE_DIMS);
        if (cropped === undefined) return;
        image = cropped.url;
        showModal = false;
        onImageSelected(cropped);
    }

    function onCrop(ev: OnCropCompleteEvent): void {
        cropData = ev;
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
                        oncropcomplete={onCrop}
                        crop={{ x: 0, y: 0 }}
                        {aspect}
                        cropShape={CROP_SHAPE} />
                </div>
            {/snippet}
            {#snippet footer()}
                <ButtonGroup>
                    <Button tiny secondary onClick={() => (showModal = false)}
                        ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                    <Button tiny onClick={applyCrop}
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
