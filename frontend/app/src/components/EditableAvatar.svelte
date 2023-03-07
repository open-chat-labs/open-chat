<script lang="ts">
    import Overlay from "./Overlay.svelte";
    import { _ } from "svelte-i18n";
    import Button from "./Button.svelte";
    import ButtonGroup from "./ButtonGroup.svelte";
    import ModalContent from "./ModalContent.svelte";
    import { createEventDispatcher } from "svelte";
    import Cropper from "svelte-easy-crop";
    import type { CropData } from "svelte-easy-crop";
    import ChooseImage from "./icons/ChooseImage.svelte";
    const dispatch = createEventDispatcher();

    export let image: string | null | undefined;
    export let disabled = false;
    export let small = false;
    export let overlayIcon = false;

    let fileinput: HTMLInputElement;
    let avatar: string | null | undefined;
    let originalImage = new Image();
    let showModal = false;
    let CROP_SIZE = 400;
    let SAVE_SIZE = 150;
    let cropData: CropData | undefined = undefined;

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
        canvas.width = SAVE_SIZE;
        canvas.height = SAVE_SIZE;
        canvas
            .getContext("2d")
            ?.drawImage(originalImage, x, y, width, height, 0, 0, SAVE_SIZE, SAVE_SIZE);

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
        <ModalContent fill={true}>
            <span slot="header">Crop image</span>
            <span slot="body">
                <div class="cropper">
                    <Cropper
                        image={avatar}
                        on:cropcomplete={onCrop}
                        cropSize={{ width: CROP_SIZE, height: CROP_SIZE }}
                        cropShape="round" />
                </div>
            </span>
            <span slot="footer">
                <ButtonGroup>
                    <Button tiny secondary={true} on:click={() => (showModal = false)}
                        >{$_("cancel")}</Button>
                    <Button tiny on:click={cropImage}>{$_("apply")}</Button>
                </ButtonGroup>
            </span>
        </ModalContent>
    </Overlay>
{/if}

<input
    hidden={true}
    type="file"
    accept=".jpg, .jpeg, .png, .gif, .svg"
    on:change={onFileSelected}
    bind:this={fileinput} />

<div class="photo-section" on:click={addPhoto}>
    <div class:small class="photo-icon">
        {#if image}
            <div class="avatar" style={`background-image: url(${image})`} />
            {#if overlayIcon}
                <div class="overlay">
                    <ChooseImage size={"3em"} color={"#fff"} />
                </div>
            {/if}
        {:else}
            <ChooseImage size={"3em"} color={"var(--icon-txt)"} />
        {/if}
    </div>
</div>

<style type="text/scss">
    .cropper {
        position: relative;
        height: 400px;
        width: 100%;
    }

    .photo-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        cursor: pointer;
    }

    .overlay {
        position: absolute;
        opacity: 0.3;
    }

    .photo-icon {
        border-radius: 50%;
        width: toRem(150);
        height: toRem(150);
        display: flex;
        justify-content: center;
        align-items: center;
        position: relative;
        background-color: var(--input-bg);

        &.small {
            width: toRem(48);
            height: toRem(48);
        }

        .avatar {
            width: 100%;
            height: 100%;
            background-size: cover;
            border-radius: 50%;
        }
    }
</style>
