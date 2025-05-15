<script lang="ts">
    import { type DefaultChannel } from "openchat-client";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import Pound from "svelte-material-icons/Pound.svelte";
    import { i18nKey } from "../../../../i18n/i18n";
    import Input from "../../../Input.svelte";

    interface Props {
        min: number;
        max: number;
        channel: DefaultChannel;
        onDeleteChannel: () => void;
    }

    let { max, min, channel = $bindable(), onDeleteChannel }: Props = $props();

    let editingChannel = $state({ ...channel });

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
            onBlur={stopEditing}
            onEnter={stopEditing}
            placeholder={i18nKey("communities.updateChannelPlaceholder")}>
            <div class="hash">
                <Pound size={$iconSize} color={"var(--icon-txt)"} />
            </div>
        </Input>
    </div>
    <div class="delete" onclick={onDeleteChannel}>
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
