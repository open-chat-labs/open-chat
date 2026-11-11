<script lang="ts">
    import { BodySmall, Container } from "component-lib";
    import type { ChatSummary, OpenChat } from "@client";
    import { allUsersStore } from "@client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import { LastOnline } from "@src/logic/conversation/lastOnline.svelte";
    import { now } from "../../stores/time";
    import Translatable from "@shared_components/Translatable.svelte";
    import DisappearLabel from "./DisappearLabel.svelte";
    import VisibilityLabel from "./VisibilityLabel.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chat: ChatSummary;
    }

    let { chat }: Props = $props();

    // a DM's line: when they were last online, or that the account is suspended (LastOnline)
    const lastOnline = new LastOnline(client, {
        userId: () => (chat.kind === "direct_chat" ? chat.them.userId : undefined),
        user: () =>
            chat.kind === "direct_chat" ? $allUsersStore.get(chat.them.userId) : undefined,
        now: () => $now,
        formatter: () => $_,
    });
</script>

{#if chat.kind === "direct_chat"}
    <Container gap={"sm"} crossAxisAlignment={"center"}>
        {#if chat.eventsTTL !== undefined}
            <DisappearLabel ttl={chat.eventsTTL} />
        {/if}
        {lastOnline.text}
    </Container>
{:else if chat.kind === "group_chat" || chat.kind === "channel"}
    <Container gap={"xs"} crossAxisAlignment={"center"}>
        <BodySmall width={"hug"} colour={"textSecondary"}>
            <VisibilityLabel isPublic={chat.public} />
        </BodySmall>
        {#if chat.eventsTTL !== undefined}
            <DisappearLabel ttl={chat.eventsTTL} />
        {/if}
        <BodySmall colour={"textSecondary"}>
            <span class="num">{chat.memberCount.toLocaleString()}</span>
            <span class="subject"><Translatable resourceKey={i18nKey("members")} /></span>
        </BodySmall>
    </Container>
{/if}

<style lang="scss">
    .subject {
        text-transform: lowercase;
    }
    .clickable {
        cursor: pointer;
    }
</style>
