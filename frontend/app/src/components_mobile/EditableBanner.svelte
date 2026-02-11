<script lang="ts">
    import EditableImageWrapper from "./EditableImageWrapper.svelte";
    import ChooseImage from "./icons/ChooseImage.svelte";

    interface Props {
        image: string | null | undefined;
        onImageSelected: (args: { url: string; data: Uint8Array }) => void;
    }

    let { image = $bindable(), onImageSelected }: Props = $props();
</script>

<EditableImageWrapper mode={"banner"} {image} {onImageSelected}>
    {#snippet children(choosePhoto: () => void, _elementWidth: number, elementHeight: number)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class={`photo-section`}
            onclick={choosePhoto}
            style={image
                ? `height: ${elementHeight}px; background-image: url(${image})`
                : `height: ${elementHeight}px`}>
            <div class={`photo-icon`}>
                <ChooseImage size={"3em"} color={image ? "#fff" : "var(--icon-txt)"} />
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
        background-color: var(--input-bg);
        background-size: cover;
        height: 200px;
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

        width: toRem(150);
        height: toRem(150);
    }
</style>
