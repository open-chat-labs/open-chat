<!-- svelte-ignore a11y-click-events-have-key-events -->
<script lang="ts">
    import type { DefaultChannel } from "openchat-client";
    import PlusCircleOutline from "svelte-material-icons/PlusCircleOutline.svelte";
    import Input from "../../../Input.svelte";
    import { _ } from "svelte-i18n";
    import { iconSize } from "../../../../stores/iconSize";
    import EditableChannel from "./EditableChannel.svelte";
    import ErrorMessage from "../../../ErrorMessage.svelte";

    const MAX_CHANNEL_LENGTH = 25;

    export let channels: DefaultChannel[];
    export let valid = true;

    let error: string | undefined = undefined;

    let nextChannelName: string = "";
    $: console.log("Channels: ", channels);

    $: {
        if (channels.length === 0) {
            error = $_("communities.mustHaveOneChannel");
        } else if (containsDuplicates(channels)) {
            error = $_("communities.mustHaveUniqueChannels");
        } else if (containsBlanks(channels)) {
            error = $_("communities.noBlankChannels");
        } else {
            error = undefined;
        }
        valid = error === undefined;
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
        channels = channels.filter((c, i) => c.createdAt !== createdAt);
    }

    function addChannel() {
        channels.push({ name: nextChannelName, createdAt: Date.now() });
        channels = channels;
        nextChannelName = "";
    }
</script>

<p class="info">
    {$_("communities.channelsInfo")}
</p>
{#each channels as channel, i (channel.createdAt)}
    <EditableChannel on:deleteChannel={() => deleteChannel(channel.createdAt)} bind:channel />
{/each}
<div class="next">
    <div class="next-txt">
        <Input
            bind:value={nextChannelName}
            minlength={1}
            maxlength={MAX_CHANNEL_LENGTH}
            countdown={true}
            on:enter={addChannel}
            placeholder={$_("communities.channelPlaceholder")} />
    </div>
    <div class="add-btn" on:click={addChannel}>
        <PlusCircleOutline size={$iconSize} color={"var(--icon-txt)"} />
    </div>
</div>

{#if error}
    <ErrorMessage>{error}</ErrorMessage>
{/if}

<style type="text/scss">
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
