<script lang="ts">
    import EditableImageWrapper from "./EditableImageWrapper.svelte";
    import ChooseImage from "./icons/ChooseImage.svelte";

    interface Props {
        image: string | null | undefined;
        disabled?: boolean;
        size?: Size;
        overlayIcon?: boolean;
        onImageSelected: (args: { url: string; data: Uint8Array }) => void;
    }

    let {
        image = $bindable(),
        size = "large",
        overlayIcon = false,
        disabled = false,
        onImageSelected,
    }: Props = $props();

    type Size = "small" | "medium" | "large";

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

    let iconSize = $derived(getIconSize(size));
</script>

<EditableImageWrapper mode={"avatar"} {disabled} {image} {onImageSelected}>
    {#snippet children(choosePhoto: () => void)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class={`photo-section avatar`} onclick={choosePhoto}>
            <div class={`photo-icon avatar ${size}`}>
                {#if image}
                    <div class="avatar" style={`background-image: url(${image})`}></div>
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
    {/snippet}
</EditableImageWrapper>

<style lang="scss">
    .photo-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: pointer;
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
        background-color: var(--input-bg);

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
