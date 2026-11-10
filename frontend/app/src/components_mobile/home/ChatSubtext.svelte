<script lang="ts">
    import { BodySmall, Container } from "component-lib";
    import type { ChatSummary, OpenChat } from "@client";
    import { allUsersStore, directChatStatus, directChatSubtitle } from "@client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import { now } from "../../stores/time";
    import Translatable from "@shared_components/Translatable.svelte";
    import DisappearLabel from "./DisappearLabel.svelte";
    import VisibilityLabel from "./VisibilityLabel.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chat: ChatSummary;
    }

    let { chat }: Props = $props();

    let userId = $derived(chat.kind === "direct_chat" ? chat.them.userId : "");
    let them = $derived($allUsersStore.get(userId));
    let checkLastOnline = $derived(
        directChatStatus(them) === "last_online" && chat.kind === "direct_chat",
    );
    let lastOnline = $state<number>();
    let subtext = $derived(directChatSubtitle($_, them, $now, lastOnline).text);

    $effect(() => {
        if (checkLastOnline && chat.kind === "direct_chat") {
            client.getLastOnlineDate(chat.them.userId, $now).then((at) => {
                lastOnline = at;
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
