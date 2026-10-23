<script lang="ts">
    import { Button, ColourVars, Column, Sheet, Subtitle } from "component-lib";
    import type { Snippet } from "svelte";
    import type { OnCropCompleteEvent } from "svelte-easy-crop";
    import {
        AVATAR_SIZE,
        BANNER_SIZE,
        cropImage,
        readImageFile,
        type CropSize,
    } from "@src/utils/imageCrop";
    import Cropper from "svelte-easy-crop";
    import Crop from "svelte-material-icons/Crop.svelte";
    import { i18nKey } from "../i18n/i18n";
    import Translatable from "@shared_components/Translatable.svelte";

    type OnChoosePhoto = () => void;

    interface Props {
        image: string | null | undefined;
        disabled?: boolean;
        mode?: Mode;
        onImageSelected: (args: { url: string; data: Uint8Array }) => void;
        children: Snippet<[OnChoosePhoto, number, number]>;
        classString?: string;
    }

    let {
        image = $bindable(),
        disabled = false,
        mode = "avatar",
        onImageSelected,
        children,
        classString,
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
                return BANNER_SIZE;
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
        closeModal();
        onImageSelected(cropped);
    }

    function closeModal() {
        showModal = false;
        selectedImage = undefined;
        cropData = undefined;
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
    <Sheet onDismiss={closeModal}>
        <Column gap={"lg"} padding={"lg"}>
            <Subtitle fontWeight={"bold"}>Crop image</Subtitle>
            <Column backgroundColor={ColourVars.surface1} height={{ size: "25rem" }}>
                <Cropper
                    image={selectedImage}
                    oncropcomplete={onCrop}
                    crop={{ x: 0, y: 0 }}
                    {aspect}
                    cropShape={CROP_SHAPE} />
            </Column>
            <Button onClick={applyCrop}>
                {#snippet icon(color)}
                    <Crop {color}></Crop>
                {/snippet}
                <Translatable resourceKey={i18nKey("apply")} />
            </Button>
        </Column>
    </Sheet>
{/if}

<input
    hidden
    type="file"
    accept=".jpg, .jpeg, .png, .gif, .svg"
    onchange={onFileSelected}
    bind:this={fileinput} />

<div class={`editable-image ${classString}`} bind:clientWidth={elementWidth}>
    {@render children(addPhoto, elementWidth, elementHeight)}
</div>
