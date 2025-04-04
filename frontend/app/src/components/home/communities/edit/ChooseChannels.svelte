<!-- svelte-ignore a11y-click-events-have-key-events -->
<script lang="ts">
    import type { DefaultChannel, ResourceKey } from "openchat-client";
    import PlusCircleOutline from "svelte-material-icons/PlusCircleOutline.svelte";
    import Input from "../../../Input.svelte";
    import { _ } from "svelte-i18n";
    import { iconSize } from "../../../../stores/iconSize";
    import EditableChannel from "./EditableChannel.svelte";
    import ErrorMessage from "../../../ErrorMessage.svelte";
    import { i18nKey } from "../../../../i18n/i18n";
    import Translatable from "../../../Translatable.svelte";

    const MIN_CHANNEL_LENGTH = 3;
    const MAX_CHANNEL_LENGTH = 40;

    export let channels: DefaultChannel[];
    export let valid = true;

    let error: ResourceKey | undefined = undefined;

    let nextChannelName: string = "";

    $: {
        if (channels.length === 0) {
            error = i18nKey("communities.mustHaveOneChannel");
        } else if (containsDuplicates(channels)) {
            error = i18nKey("communities.mustHaveUniqueChannels");
        } else if (containsBlanks(channels)) {
            error = i18nKey("communities.noBlankChannels");
        } else if (containsInvalid(channels)) {
            error = i18nKey("communities.noInvalidChannels", {
                min: MIN_CHANNEL_LENGTH,
                max: MAX_CHANNEL_LENGTH,
            });
        } else {
            error = undefined;
        }
        valid = error === undefined;
    }

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
{#each channels as channel (channel.createdAt)}
    <EditableChannel
        min={MIN_CHANNEL_LENGTH}
        max={MAX_CHANNEL_LENGTH}
        on:deleteChannel={() => deleteChannel(channel.createdAt)}
        bind:channel />
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
    <div class="add-btn" on:click={addChannel}>
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
