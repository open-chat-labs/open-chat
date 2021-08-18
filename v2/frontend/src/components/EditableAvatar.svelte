<script lang="ts">
    import Camera from "svelte-material-icons/Camera.svelte";
    import Overlay from "./Overlay.svelte";
    import Link from "./Link.svelte";
    import ModalContent from "./ModalContent.svelte";
    import { createEventDispatcher } from "svelte";
    import Cropper from "svelte-easy-crop";
    import type { CropData } from "svelte-easy-crop";
    const dispatch = createEventDispatcher();

    export let image: string | null | undefined;

    let fileinput: HTMLInputElement;
    let avatar: string | null | undefined;
    let originalImage = new Image();
    let showModal = false;
    let CROP_SIZE = 300;
    let cropData: CropData | undefined = undefined;

    function addPhoto() {
        fileinput.click();
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
        canvas.width = CROP_SIZE;
        canvas.height = CROP_SIZE;
        canvas
            .getContext("2d")
            ?.drawImage(originalImage, x, y, width, height, 0, 0, CROP_SIZE, CROP_SIZE);
        image = canvas.toDataURL("image/jpeg");
        showModal = false;
        dispatch("imageSelected", image);
    }

    function onCrop(ev: CustomEvent<CropData>): void {
        cropData = ev.detail;
    }
</script>

<Overlay active={showModal}>
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
            <Link on:click={cropImage}>Apply</Link>
        </span>
    </ModalContent>
</Overlay>

<input
    hidden={true}
    type="file"
    accept=".jpg, .jpeg, .png, .gif"
    on:change={onFileSelected}
    bind:this={fileinput} />

<div class="photo-section" on:click={addPhoto}>
    <div class="photo-icon">
        {#if image}
            <div class="avatar" style={`background-image: url(${image})`} />
        {:else}
            <Camera size={"3em"} color={"#aaa"} />
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

    .photo-icon {
        border: 1px solid #ccc;
        border-radius: 50%;
        width: 90px;
        height: 90px;
        display: flex;
        justify-content: center;
        align-items: center;

        .avatar {
            width: 100%;
            height: 100%;
            background-size: cover;
            border-radius: 50%;
        }
    }
</style>
