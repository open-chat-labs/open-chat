<!-- A community's channels as a card: "#name", its members, and a chevron; a tap opens the channel. The preview's
     public channels (N8b: read with the join bar) and the community details' read-only Channels (N8a). -->
<script lang="ts">
    import type { ChannelIdentifier } from "@client";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import { _ } from "svelte-i18n";

    type Channel = { id: ChannelIdentifier; name: string; memberCount: number };
    type Props = {
        label: string;
        note?: string;
        channels: Channel[];
        onOpen: (id: ChannelIdentifier) => void;
    };

    let { label, note, channels, onOpen }: Props = $props();
</script>

<SettingsGroup {label} {note}>
    {#each channels as channel (channel.id.channelId)}
        <button type="button" class="settings-row channel" onclick={() => onOpen(channel.id)}>
            <span class="hash">#</span>
            <span class="channel-name">{channel.name}</span>
            <span class="count">
                {$_("native.community.preview.channelMembers", {
                    values: { count: channel.memberCount },
                })}
            </span>
            <span class="chevron"></span>
        </button>
    {/each}
</SettingsGroup>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .channel {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        min-height: 52px;
        padding: 0 16px;
        border: 0;
        background: none;
        color: var(--ink);
        text-align: start;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active {
            background: var(--overlay-1);
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .hash {
        font: 700 16px/1 var(--font-mono);
        color: var(--ink-4);
    }

    .channel-name {
        flex: 1;
        min-width: 0;
        font: 500 15px/1.2 var(--font-sans);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .count {
        font: 500 12.5px/1 var(--font-sans);
        color: var(--ink-4);
    }

    .chevron {
        flex: none;
        @include icon(chevron-right, 14px);
        color: var(--ink-4);

        &:dir(rtl) {
            transform: rotate(180deg);
        }
    }
</style>
