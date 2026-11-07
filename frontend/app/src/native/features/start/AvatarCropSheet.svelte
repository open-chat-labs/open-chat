<!-- Cropping the photo picked for the account (Pick a username's avatar): the picked image in a
     round crop the person drags and pinches, in a sheet of a fixed height, and Done in its header.
     The crop is the shared one (utils/imageCrop, as src/web's ImageCropDialog and the old UIs'
     EditableImageWrapper); the host scales the area to the avatar's size. -->
<script lang="ts">
    import BottomSheet from "@openchat/ui/src/native/BottomSheet.svelte";
    import type { CropArea } from "@src/utils/imageCrop";
    import Cropper, { type OnCropCompleteEvent } from "svelte-easy-crop";
    import { _ } from "svelte-i18n";

    type Props = {
        open: boolean;
        /** The picked image, a data URL. */
        source: string;
        /** Done, with the area picked in the image's pixels. */
        onCrop: (area: CropArea) => void;
        onClose: () => void;
    };

    let { open, source, onCrop, onClose }: Props = $props();

    // the host mounts it again for each image picked, so this is always this image's
    let area = $state<CropArea>();

    function cropped(e: OnCropCompleteEvent) {
        area = e.pixels;
    }

    function done() {
        if (area !== undefined) onCrop(area);
    }
</script>

<!-- TODO(design): no crop step in the native design; GAPS.md -->
<BottomSheet
    {open}
    {onClose}
    title={$_("native.start.signUp.photoTitle")}
    onAction={done}
    height="min(560px, 82%)">
    <div class="cropper">
        <Cropper
            image={source}
            crop={{ x: 0, y: 0 }}
            zoom={1}
            aspect={1}
            cropShape="round"
            showGrid={false}
            oncropcomplete={cropped} />
    </div>
    <p class="hint">{$_("native.start.signUp.photoHint")}</p>
</BottomSheet>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .cropper {
        position: relative;
        flex: 1;
        min-height: 0;
        margin: 0 var(--space-16);
        border-radius: var(--radius-xl);
        overflow: hidden;
        background: var(--surface-0);
    }

    .hint {
        flex: none;
        margin: 0;
        padding: var(--space-12) var(--space-16) var(--space-16);
        text-align: center;
        font: var(--weight-medium) text-size(13px) / 1.4 var(--font-sans);
        color: var(--ink-3);
    }
</style>
