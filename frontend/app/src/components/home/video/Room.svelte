<script lang="ts">
    import daily from "@daily-co/daily-js";
    import type { DailyCall, DailyThemeConfig } from "@daily-co/daily-js";
    import { type ChatSummary, type OpenChat } from "openchat-client";
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

    onMount(async () => {
        if (chat.kind !== "group_chat") return;

        const chatId = chat.id.groupId;

        // first we need to get an access jwt from the oc backend
        const token = await client.getVideoChatAccessToken(chatId);
        console.log("Token: ", token);

        callframe = daily.createFrame(container, {
            token,
            showLeaveButton: true,
            iframeStyle: {
                width: "100%",
                height: "100%",
            },
            url: `https://openchat.daily.co/${chatId}`,
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
