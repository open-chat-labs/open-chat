<script lang="ts">
    import {
        allUsersStore,
        AvatarSize,
        communitiesStore,
        iconSize,
        selectedCommunitySummaryStore,
        type ChatIdentifier,
        type OpenChat,
        type VideoCallType,
    } from "openchat-client";
    import { getContext } from "svelte";
    import Phone from "svelte-material-icons/Phone.svelte";
    import PhoneHangup from "svelte-material-icons/PhoneHangup.svelte";
    import Tooltip from "../../../components/tooltip/Tooltip.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import {
        activeVideoCall,
        incomingVideoCall,
        ringtoneUrls,
        selectedRingtone,
        type IncomingVideoCall,
        type RingtoneKey,
    } from "../../../stores/video";
    import Avatar from "../../Avatar.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Overlay from "../../Overlay.svelte";
    import Translatable from "../../Translatable.svelte";

    interface Props {
        onJoinVideoCall: (chatId: ChatIdentifier, callType: VideoCallType) => void;
    }

    let { onJoinVideoCall }: Props = $props();

    const client = getContext<OpenChat>("client");

    const chat = $derived(normaliseChatSummary($incomingVideoCall));
    const ringtoneUrl = $derived(ringtoneUrls[$selectedRingtone as RingtoneKey]);
    const isOnAnotherCall = $derived($activeVideoCall !== undefined);

    function normaliseChatSummary(call: IncomingVideoCall | undefined) {
        if (call) {
            const chat = client.lookupChatSummary(call.chatId);
            const initiator = $allUsersStore.get(call.userId);
            if (chat && initiator) {
                switch (chat.kind) {
                    case "direct_chat":
                        const them = $allUsersStore.get(chat.them.userId);
                        return {
                            chatId: chat.id,
                            name: client.displayName(them),
                            avatarUrl: client.userAvatarUrl(them),
                            initiator: initiator.username,
                        };
                    case "group_chat":
                        return {
                            chatId: chat.id,
                            name: chat.name,
                            avatarUrl: client.groupAvatarUrl(chat),
                            initiator: initiator.username,
                        };
                    case "channel":
                        return {
                            chatId: chat.id,
                            name: `${
                                $communitiesStore.get({
                                    kind: "community",
                                    communityId: chat.id.communityId,
                                })?.name
                            } > ${chat.name}`,
                            avatarUrl: client.groupAvatarUrl(chat, $selectedCommunitySummaryStore),
                            initiator: initiator.username,
                        };
                }
            }
        }
    }

    function join() {
        if ($incomingVideoCall !== undefined) {
            onJoinVideoCall($incomingVideoCall.chatId, $incomingVideoCall.callType);
        }
    }

    function cancel() {
        incomingVideoCall.set(undefined);
    }
</script>

{#if chat !== undefined}
    {#if !isOnAnotherCall}
        <audio playsinline={true} autoplay={true} src={ringtoneUrl} muted={false} preload="auto">
        </audio>
    {/if}

    <Overlay onClose={cancel} dismissible>
        <ModalContent hideHeader hideFooter closeIcon>
            {#snippet body()}
                <span class="body">
                    <div class="details">
                        <div class="avatar">
                            <Avatar url={chat.avatarUrl} size={AvatarSize.Default} />
                        </div>
                        <div class="txt">
                            <div class="name">
                                {chat.name}
                            </div>
                            <div class="msg">
                                <Translatable
                                    resourceKey={i18nKey("videoCall.remoteStart", {
                                        name: chat.initiator,
                                    })} />
                            </div>
                        </div>
                    </div>
                    <div class="btns">
                        <Tooltip position={"top"} align={"middle"}>
                            <div role="button" onclick={cancel} class="btn ignore">
                                <PhoneHangup size={$iconSize} color={"var(--txt)"} />
                            </div>
                            {#snippet popupTemplate()}
                                <Translatable resourceKey={i18nKey("videoCall.ignore")} />
                            {/snippet}
                        </Tooltip>
                        <Tooltip position={"top"} align={"middle"}>
                            <div role="button" onclick={join} class="btn join">
                                <Phone size={$iconSize} color={"var(--txt)"} />
                            </div>
                            {#snippet popupTemplate()}
                                <Translatable resourceKey={i18nKey("videoCall.join")} />
                            {/snippet}
                        </Tooltip>
                    </div>
                </span>
            {/snippet}
        </ModalContent>
    </Overlay>
{/if}

<style lang="scss">
    .body {
        display: flex;
        gap: $sp3;
        align-items: center;
        justify-content: space-between;
        padding: $sp3 0;

        @include mobile() {
            flex-direction: column;
            gap: $sp5;
            padding: $sp4 0;
        }

        .details {
            display: flex;
            align-items: center;
            gap: $sp3;
        }

        .txt {
            .name {
                @include font(bold, normal, fs-140);
                margin-bottom: $sp1;
            }
            .msg {
                @include font(light, normal, fs-100);
            }
        }

        .btns {
            display: flex;
            gap: $sp4;

            @include mobile() {
                justify-content: space-evenly;
                gap: $sp5;
            }
        }

        .btn {
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            width: 45px;
            height: 45px;
            cursor: pointer;

            @include mobile() {
                width: 60px;
                height: 60px;
            }

            &.ignore {
                background-color: var(--vote-no-color);
            }
            &.join {
                background-color: var(--vote-yes-color);
            }
        }
    }
</style>
