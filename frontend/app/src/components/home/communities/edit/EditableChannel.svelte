<!-- svelte-ignore a11y-click-events-have-key-events -->
<script lang="ts">
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import Pound from "svelte-material-icons/Pound.svelte";
    import Input from "../../../Input.svelte";
    import type { DefaultChannel } from "openchat-client";
    import { iconSize } from "../../../../stores/iconSize";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, onMount } from "svelte";
    import { i18nKey } from "../../../../i18n/i18n";

    const dispatch = createEventDispatcher();

    export let min: number;
    export let max: number;
    export let channel: DefaultChannel;

    let editingChannel = channel;

    onMount(() => {
        editingChannel = { ...channel };
    });

    function deleteChannel() {
        dispatch("deleteChannel");
    }

    function stopEditing() {
        channel.name = editingChannel.name;
    }
</script>

<div class="channel">
    <div class="channel-name">
        <Input
            bind:value={editingChannel.name}
            minlength={min}
            maxlength={max}
            countdown
            invalid={editingChannel.name.length < min || editingChannel.name.length > max}
            onblur={stopEditing}
            on:enter={stopEditing}
            placeholder={i18nKey("communities.updateChannelPlaceholder")}>
            <div class="hash">
                <Pound size={$iconSize} color={"var(--icon-txt)"} />
            </div>
        </Input>
    </div>
    <div class="delete" on:click={deleteChannel}>
        <DeleteOutline size={$iconSize} color={"var(--icon-txt)"} />
    </div>
</div>

<style lang="scss">
    :global(.channel-name .textbox) {
        padding-left: 38px !important;
    }

    .channel {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: $sp3;
    }
    .channel-name {
        flex: auto;
    }
    .hash {
        position: absolute;
        left: $sp3;
        top: calc(50% - 12px);
    }
    .delete {
        cursor: pointer;
    }
</style>
