<script lang="ts">
    import daily from "@daily-co/daily-js";
    import type { DailyCall, DailyThemeConfig } from "@daily-co/daily-js";
    import { type ChatIdentifier, type ChatSummary, type OpenChat } from "openchat-client";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { currentTheme } from "../../../theme/themes";
    import type { Theme } from "../../../theme/types";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let chat: ChatSummary;

    $: user = client.user;

    let container: HTMLDivElement;
    let callframe: DailyCall | undefined = undefined;

    $: {
        if (callframe !== undefined) {
            setTheme($currentTheme, callframe);
        }
    }

    function setTheme(theme: Theme, call: DailyCall) {
        call.setTheme(getThemeConfig(theme));
    }

    function getThemeConfig(theme: Theme): DailyThemeConfig {
        return {
            colors: {
                accent: `${theme.daily.accent}`,
                accentText: `${theme.daily.accentText}`,
                background: `${theme.daily.background}`,
                backgroundAccent: `${theme.daily.backgroundAccent}`,
                baseText: `${theme.daily.baseText}`,
                border: `${theme.daily.border}`,
                mainAreaBg: `${theme.daily.mainAreaBg}`,
                mainAreaBgAccent: `${theme.daily.mainAreaBgAccent}`,
                mainAreaText: `${theme.daily.mainAreaText}`,
                supportiveText: `${theme.daily.supportiveText}`,
            },
        };
    }

    function chatIdToRoomId(chatId: ChatIdentifier): string {
        switch (chatId.kind) {
            case "channel":
                return `channel_${chatId.communityId}_${chatId.channelId}`;
            case "direct_chat":
                return `direct_${chatId.userId}`;
            case "group_chat":
                return `group_${chatId.groupId}`;
        }
    }

    onMount(async () => {
        // first we need to get an access jwt from the oc backend
        const token = await client.getVideoChatAccessToken(chat.id);
        const roomId = chatIdToRoomId(chat.id);

        callframe = daily.createFrame(container, {
            token,
            showLeaveButton: true,
            iframeStyle: {
                width: "100%",
                height: "100%",
            },
            url: `https://openchat.daily.co/${roomId}`,
            userName: $user.username,
            theme: getThemeConfig($currentTheme),
        });

        callframe.on("left-meeting", () => dispatch("leftMeeting"));

        await callframe.join();
    });
</script>

<div bind:this={container} class="container"></div>

<style lang="scss">
    .container {
        display: flex;
        flex-direction: column;
        height: 100%;
    }
</style>
