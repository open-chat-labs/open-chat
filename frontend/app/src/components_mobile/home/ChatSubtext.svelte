<script lang="ts">
    import { BodySmall, Container } from "component-lib";
    import type { ChatSummary, OpenChat } from "openchat-client";
    import { allUsersStore } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import { now } from "../../stores/time";
    import Translatable from "../Translatable.svelte";
    import DisappearLabel from "./DisappearLabel.svelte";
    import VisibilityLabel from "./VisibilityLabel.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chat: ChatSummary;
    }

    let { chat }: Props = $props();

    let userId = $derived(chat.kind === "direct_chat" ? chat.them.userId : "");
    let isBot = $derived($allUsersStore.get(userId)?.kind === "bot");
    let isSuspended = $derived($allUsersStore.get(userId)?.suspended ?? false);
    let subtext = $derived(isSuspended ? $_("accountSuspended") : "");
    let checkLastOnline = $derived(!isSuspended && !isBot && chat.kind === "direct_chat");

    $effect(() => {
        if (checkLastOnline && chat.kind === "direct_chat") {
            client.getLastOnlineDate(chat.them.userId, $now).then((lastOnline) => {
                if (lastOnline !== undefined && lastOnline !== 0) {
                    [subtext] = client.formatLastOnlineDate($_, $now, lastOnline);
                } else {
                    subtext = "";
                }
            });
        }
    });
</script>

{#if chat.kind === "direct_chat"}
    <Container gap={"sm"} crossAxisAlignment={"center"}>
        {#if chat.eventsTTL !== undefined}
            <DisappearLabel ttl={chat.eventsTTL} />
        {/if}
        {subtext}
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
