<!-- Cropping a picked image before it's saved (an avatar, round; a profile background), as the old
     UI's EditableImageWrapper did. -->
<script lang="ts">
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import type { Dimensions } from "@client";
    import type { CropArea } from "@src/utils/imageCrop";
    import Cropper, { type OnCropCompleteEvent } from "svelte-easy-crop";
    import { _ } from "svelte-i18n";

    interface Props {
        // the picked image, a data URL
        source: string;
        // the size it's saved at, whose shape the crop keeps
        size: Dimensions;
        round?: boolean;
        // the same image is still uploading: Apply waits for it
        busy?: boolean;
        onCrop: (area: CropArea) => void;
        onClose: () => void;
    }

    let { source, size, round = false, busy = false, onCrop, onClose }: Props = $props();

    let area = $state<CropArea>();

    function cropped(e: OnCropCompleteEvent) {
        area = e.pixels;
    }

    function apply() {
        if (area !== undefined && !busy) onCrop(area);
    }
</script>

<!-- TODO(design): no crop dialog in the design; GAPS.md -->
<DialogShell title={$_("cropImage")} width={560} height="auto" {onClose}>
    <div class="cropper">
        <Cropper
            image={source}
            crop={{ x: 0, y: 0 }}
            aspect={size.width / size.height}
            cropShape={round ? "round" : "rect"}
            oncropcomplete={cropped} />
    </div>
    <div class="actions">
        <Button label={$_("cancel")} variant="secondary" onClick={onClose} />
        {#if busy}<Spinner />{/if}
        <Button label={$_("apply")} disabled={area === undefined || busy} onClick={apply} />
    </div>
</DialogShell>

<style>
    .cropper {
        position: relative;
        height: 400px;
        border-radius: var(--radius-lg);
        overflow: hidden;
        background: var(--surface-0);
    }

    .actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--space-10);
        margin-block-start: var(--space-16);
    }
</style>
