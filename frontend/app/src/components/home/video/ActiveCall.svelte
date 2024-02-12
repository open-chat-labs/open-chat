<script lang="ts">
    import {
        chatIdentifiersEqual,
        type ChatIdentifier,
        type ChatSummary,
        OpenChat,
    } from "openchat-client";
    import { activeVideoCall, camera, microphone } from "../../../stores/video";
    import { currentTheme } from "../../../theme/themes";
    import type { Theme } from "../../../theme/types";
    import type { DailyThemeConfig } from "@daily-co/daily-js";
    import daily from "@daily-co/daily-js";
    import AreYouSure from "../../AreYouSure.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { getContext } from "svelte";
    import { toastStore } from "../../../stores/toast";

    const client = getContext<OpenChat>("client");

    $: selectedChatId = client.selectedChatId;
    $: user = client.user;
    let container: HTMLDivElement;
    let confirmSwitchTo: ChatSummary | undefined = undefined;

    $: {
        activeVideoCall.changeTheme(getThemeConfig($currentTheme));
    }

    export async function startVideoCall(chat: ChatSummary) {
        try {
            if ($activeVideoCall !== undefined) {
                confirmSwitchTo = chat;
                return;
            }

            activeVideoCall.joining(chat.id);

            // first we need tojoin access jwt from the oc backend
            const token = await client.getVideoChatAccessToken(chat.id);
            const roomId = chatIdToRoomId(chat.id);
            const call = daily.createFrame(container, {
                token,
                showLeaveButton: true,
                iframeStyle: {
                    position: "absolute",
                },
                url: `https://openchat.daily.co/${roomId}`,
                userName: $user.username,
                theme: getThemeConfig($currentTheme),
            });

            call.on("left-meeting", async () => {
                activeVideoCall.endCall();
            });

            call.on("participant-updated", (ev) => {
                if (ev?.participant.local) {
                    microphone.set(ev?.participant.tracks.audio.state !== "off");
                    camera.set(ev?.participant.tracks.video.state !== "off");
                }
            });

            await call.join();

            activeVideoCall.setCall(chat.id, call);
        } catch (err) {
            toastStore.showFailureToast(i18nKey("videoCall.callFailed"), err);
            activeVideoCall.endCall();
            console.error("Unable to start video call: ", err);
        }
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

    function switchCall(confirmed: boolean): Promise<void> {
        if (confirmed && confirmSwitchTo) {
            activeVideoCall.endCall();
            const chat = confirmSwitchTo;
            confirmSwitchTo = undefined;
            return startVideoCall(chat);
        }
        confirmSwitchTo = undefined;
        return Promise.resolve();
    }
</script>

{#if confirmSwitchTo}
    <AreYouSure message={i18nKey("videoCall.switchCall")} action={switchCall} />
{/if}

<div
    class:visible={$activeVideoCall &&
        chatIdentifiersEqual($activeVideoCall.chatId, $selectedChatId)}
    bind:this={container}
    class="video-call-container">
</div>

<style lang="scss">
    .video-call-container {
        position: absolute;
        display: none;
        flex-direction: column;
        @include z-index("video-call");

        &.visible {
            display: flex;
        }
    }
</style>
