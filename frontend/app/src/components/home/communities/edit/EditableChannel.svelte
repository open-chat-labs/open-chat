<!-- svelte-ignore a11y-click-events-have-key-events -->
<script lang="ts">
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import Pound from "svelte-material-icons/Pound.svelte";
    import Input from "../../../Input.svelte";
    import type { DefaultChannel } from "openchat-client";
    import { iconSize } from "../../../../stores/iconSize";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, onMount } from "svelte";

    const dispatch = createEventDispatcher();

    const MAX_CHANNEL_LENGTH = 25;

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
            minlength={1}
            maxlength={MAX_CHANNEL_LENGTH}
            countdown={true}
            invalid={editingChannel.name.length < 1}
            on:blur={stopEditing}
            on:enter={stopEditing}
            placeholder={$_("communities.updateChannelPlaceholder")}>
            <div class="hash">
                <Pound size={$iconSize} color={"var(--icon-txt)"} />
            </div>
        </Input>
    </div>
    <div class="delete" on:click={deleteChannel}>
        <DeleteOutline size={$iconSize} color={"var(--icon-txt)"} />
    </div>
</div>

<style type="text/scss">
    :global(.channel-name .textbox) {
        padding-left: 38px;
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
