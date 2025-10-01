<script lang="ts">
    import { IconButton } from "component-lib";
    import ImageEditOutline from "svelte-material-icons/ImageEditOutline.svelte";
    import EditableImageWrapper from "./EditableImageWrapper.svelte";

    interface Props {
        image: string | null | undefined;
        disabled?: boolean;
        size?: Size;
        onImageSelected: (args: { url: string; data: Uint8Array }) => void;
    }

    let {
        image = $bindable(),
        size = "large",
        disabled = false,
        onImageSelected,
    }: Props = $props();

    type Size = "small" | "medium" | "large" | "headline";
</script>

<EditableImageWrapper mode={"avatar"} {disabled} {image} {onImageSelected}>
    {#snippet children(choosePhoto: () => void)}
        <div class="border">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div onclick={choosePhoto} class={`photo-icon avatar ${size}`}>
                {#if image}
                    <div class="avatar" style={`background-image: url(${image})`}></div>
                {/if}
            </div>
            <div class="editable_avatar_edit_icon">
                <IconButton onclick={choosePhoto} mode={"primary"}>
                    {#snippet icon(color)}
                        <ImageEditOutline {color} />
                    {/snippet}
                </IconButton>
            </div>
        </div>
    {/snippet}
</EditableImageWrapper>

<style lang="scss">
    :global(.editable_avatar_edit_icon svg) {
        width: var(--icon-md);
        height: var(--icon-md);
    }

    .editable_avatar_edit_icon {
        position: absolute;
        bottom: 6px;
        right: 6px;
        border-radius: var(--rad-circle);
        background-color: var(--background-1);
        border: 4px solid var(--background-0);
    }

    .border {
        // background: var(--gradient);
        background: var(--background-0);
        border-radius: var(--rad-circle);
        padding: 6px;
        position: relative;
    }

    .photo-icon {
        border-radius: var(--rad-circle);
        display: flex;
        justify-content: center;
        align-items: center;
        position: relative;
        background-color: var(--text-tertiary);

        &.headline {
            width: toRem(154);
            height: toRem(154);
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
