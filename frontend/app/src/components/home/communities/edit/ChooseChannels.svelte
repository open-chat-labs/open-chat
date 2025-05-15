<script lang="ts">
    import { type DefaultChannel } from "openchat-client";
    import PlusCircleOutline from "svelte-material-icons/PlusCircleOutline.svelte";
    import { i18nKey } from "../../../../i18n/i18n";
    import ErrorMessage from "../../../ErrorMessage.svelte";
    import Input from "../../../Input.svelte";
    import Translatable from "../../../Translatable.svelte";
    import EditableChannel from "./EditableChannel.svelte";

    const MIN_CHANNEL_LENGTH = 3;
    const MAX_CHANNEL_LENGTH = 40;

    interface Props {
        channels: DefaultChannel[];
        valid?: boolean;
    }

    let { channels = $bindable(), valid = $bindable(true) }: Props = $props();

    let error = $derived.by(() => {
        if (channels.length === 0) {
            return i18nKey("communities.mustHaveOneChannel");
        } else if (containsDuplicates(channels)) {
            return i18nKey("communities.mustHaveUniqueChannels");
        } else if (containsBlanks(channels)) {
            return i18nKey("communities.noBlankChannels");
        } else if (containsInvalid(channels)) {
            return i18nKey("communities.noInvalidChannels", {
                min: MIN_CHANNEL_LENGTH,
                max: MAX_CHANNEL_LENGTH,
            });
        } else {
            return undefined;
        }
    });

    $effect(() => {
        const isValid = error === undefined;
        if (isValid !== valid) {
            valid = isValid;
        }
    });

    let nextChannelName: string = $state("");

    function containsInvalid(channels: DefaultChannel[]): boolean {
        return channels
            .map((c) => c.name)
            .some((name) => name.length < MIN_CHANNEL_LENGTH || name.length > MAX_CHANNEL_LENGTH);
    }

    function containsBlanks(channels: DefaultChannel[]): boolean {
        return channels.map((c) => c.name).some((name) => name === "");
    }

    function containsDuplicates(channels: DefaultChannel[]): boolean {
        const names = channels.reduce((s, c) => {
            s.add(c.name.toLowerCase());
            return s;
        }, new Set<string>());
        return names.size < channels.length;
    }

    function deleteChannel(createdAt: number) {
        channels = channels.filter((c) => c.createdAt !== createdAt);
    }

    function addChannel() {
        channels.push({ name: nextChannelName, createdAt: Date.now() });
        channels = channels;
        nextChannelName = "";
    }
</script>

<p class="info">
    <Translatable resourceKey={i18nKey("communities.channelsInfo")} />
</p>
{#each channels as channel, i (channel.createdAt)}
    <EditableChannel
        min={MIN_CHANNEL_LENGTH}
        max={MAX_CHANNEL_LENGTH}
        onDeleteChannel={() => deleteChannel(channel.createdAt)}
        bind:channel={channels[i]} />
{/each}
<div class="next">
    <div class="next-txt">
        <Input
            bind:value={nextChannelName}
            minlength={MIN_CHANNEL_LENGTH}
            maxlength={MAX_CHANNEL_LENGTH}
            countdown
            onEnter={addChannel}
            placeholder={i18nKey("communities.channelPlaceholder")} />
    </div>
    <div class="add-btn" onclick={addChannel}>
        <PlusCircleOutline size={$iconSize} color={"var(--icon-txt)"} />
    </div>
</div>

{#if error}
    <ErrorMessage><Translatable resourceKey={error} /></ErrorMessage>
{/if}

<style lang="scss">
    .info {
        @include font(book, normal, fs-80, 22);
        color: var(--txt-light);
        margin-bottom: $sp5;
    }

    .next {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: $sp3;
    }

    .next-txt {
        flex: auto;
    }

    .add-btn {
        cursor: pointer;
    }
</style>
