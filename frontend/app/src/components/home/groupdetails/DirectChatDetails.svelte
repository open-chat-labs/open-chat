<script lang="ts">
    import Button from "@src/components/Button.svelte";
    import ButtonGroup from "@src/components/ButtonGroup.svelte";
    import Checkbox from "@src/components/Checkbox.svelte";
    import HoverIcon from "@src/components/HoverIcon.svelte";
    import HeartMinus from "@src/components/icons/HeartMinus.svelte";
    import HeartPlus from "@src/components/icons/HeartPlus.svelte";
    import SectionHeader from "@src/components/SectionHeader.svelte";
    import Translatable from "@src/components/Translatable.svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import { activeVideoCall } from "@src/stores/video";
    import { currentTheme } from "@src/theme/themes";
    import { darkenHexColour } from "@src/theme/utils";
    import type { DirectChatSummary, OptionUpdate, PublicProfile } from "openchat-client";
    import {
        allUsersStore,
        blockedUsersStore,
        chatIdentifiersEqual,
        favouritesStore,
        iconSize,
        mobileWidth,
        OpenChat,
        publish,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import CancelIcon from "svelte-material-icons/Cancel.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import Headphones from "svelte-material-icons/Headphones.svelte";
    import PhoneHangup from "svelte-material-icons/PhoneHangup.svelte";
    import DurationPicker from "../DurationPicker.svelte";
    import Markdown from "../Markdown.svelte";
    import UserProfileCard from "../profile/UserProfileCard.svelte";

    const client = getContext<OpenChat>("client");
    const ONE_WEEK = 604800000n;

    interface Props {
        chat: DirectChatSummary;
        onClose: () => void;
    }

    let { onClose, chat }: Props = $props();

    let blocked = $derived($blockedUsersStore.has(chat.them.userId));
    let user = $derived($allUsersStore.get(chat.them.userId));
    let profile = $state<PublicProfile | undefined>();
    let disappearingMessages = $state(chat.eventsTTL !== undefined);
    let eventsTTL = $state(chat.eventsTTL);
    let originalTTL = $state(chat.eventsTTL);
    let saving = $state(false);
    let dirty = $derived(eventsTTL !== chat.eventsTTL);
    let darkenedCall = $derived(darkenHexColour($currentTheme.vote.yes.color, 20));
    let videoCallInProgress = $derived(chat.videoCallInProgress !== undefined);
    let blockLabel = $derived(blocked ? i18nKey("Unblock") : i18nKey("Block"));
    let inCall = $derived(
        videoCallInProgress &&
            $activeVideoCall !== undefined &&
            chatIdentifiersEqual($activeVideoCall.chatId, chat.id),
    );
    let videoMenuText = $derived(
        videoCallInProgress ? (inCall ? i18nKey("Leave") : i18nKey("Join")) : i18nKey("Start"),
    );

    onMount(async () => {
        profile = await client.getPublicProfile(chat.them.userId);
    });

    $effect(() => {
        if (chat.eventsTTL !== originalTTL) {
            eventsTTL = originalTTL = chat.eventsTTL;
            disappearingMessages = chat.eventsTTL !== undefined;
        }
    });

    $effect(() => {
        dirty = eventsTTL !== chat.eventsTTL;
    });

    function toggleDisappearingMessages() {
        disappearingMessages = !disappearingMessages;
        if (!disappearingMessages) {
            eventsTTL = undefined;
        } else {
            eventsTTL = ONE_WEEK;
        }
    }

    function getUpdate(): OptionUpdate<bigint> {
        if (eventsTTL !== undefined) {
            return { value: eventsTTL };
        } else if (chat.eventsTTL !== undefined) {
            return "set_to_none";
        } else {
            return undefined;
        }
    }

    async function updateDirectChatDetails(e: Event) {
        e.preventDefault();
        if (!dirty) return;

        saving = true;

        const success = await client
            .updateDirectChatSettings(chat, getUpdate())
            .finally(() => (saving = false));
        if (success) {
            originalTTL = originalTTL = chat.eventsTTL;
        }
    }
    function addToFavourites() {
        client.addToFavourites(chat.id);
    }

    function removeFromFavourites() {
        client.removeFromFavourites(chat.id);
    }

    function startVideoCall() {
        if (inCall) {
            publish("hangup");
        } else {
            publish("startVideoCall", {
                chatId: chat.id,
                callType: "default",
                join: videoCallInProgress,
            });
        }
    }

    function toggleBlocked() {
        if (blocked) {
            unblockUser();
        } else {
            blockUser();
        }
    }

    function blockUser() {
        client.blockUserFromDirectChat(chat.them.userId).then((success) => {
            if (success) {
                toastStore.showSuccessToast(i18nKey("blockUserSucceeded"));
            } else {
                toastStore.showFailureToast(i18nKey("blockUserFailed"));
            }
        });
    }

    function unblockUser() {
        client.unblockUserFromDirectChat(chat.them.userId).then((success) => {
            if (success) {
                toastStore.showSuccessToast(i18nKey("unblockUserSucceeded"));
            } else {
                toastStore.showFailureToast(i18nKey("unblockUserFailed"));
            }
        });
    }
</script>

<SectionHeader border={false} flush={!$mobileWidth} shadow>
    {#if !$favouritesStore.has(chat.id)}
        <HoverIcon onclick={addToFavourites}>
            <HeartPlus size={$iconSize} color={"var(--menu-warn)"} />
        </HoverIcon>
    {:else}
        <HoverIcon onclick={removeFromFavourites}>
            <HeartMinus size={$iconSize} color={"var(--menu-warn)"} />
        </HoverIcon>
    {/if}
    <h4>
        <Translatable
            resourceKey={i18nKey(`Direct chat with ${client.getDisplayName(chat.them.userId)}`)} />
    </h4>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span title={$_("close")} class="close" onclick={onClose}>
        <HoverIcon>
            <Close size={$iconSize} color={"var(--icon-txt)"} />
        </HoverIcon>
    </span>
</SectionHeader>

{#if user !== undefined}
    <div class="wrapper">
        <div class="user-form">
            {#if profile}
                <div class="profile-card">
                    <UserProfileCard {profile} {user} userProfileMode></UserProfileCard>
                </div>
            {/if}
            {#if profile && profile.bio.length > 0}
                <p class="bio"><Markdown inline={false} text={profile.bio} /></p>
            {/if}
            <div style={`--darkened-call: ${darkenedCall}`} class="controls">
                <ButtonGroup align={"fill"}>
                    <Button onClick={startVideoCall} cls="call-user icon-button">
                        {#if inCall}
                            <PhoneHangup size={$iconSize} color={"var(--button-txt)"} />
                        {:else}
                            <Headphones size={$iconSize} color={"var(--button-txt)"} />
                        {/if}
                        <Translatable resourceKey={videoMenuText} />
                    </Button>
                    <Button onClick={toggleBlocked} cls="icon-button" danger>
                        <CancelIcon size={$iconSize} color={"var(--button-txt)"} />
                        <Translatable resourceKey={blockLabel} />
                    </Button>
                </ButtonGroup>
            </div>
            <div class="disappearing">
                <Checkbox
                    id="disappearing-messages"
                    onChange={toggleDisappearingMessages}
                    label={i18nKey("disappearingMessages.label")}
                    align={"start"}
                    checked={disappearingMessages}>
                    <div class="section-title disappear">
                        <Translatable resourceKey={i18nKey("disappearingMessages.label")} />
                    </div>
                </Checkbox>
                {#if disappearingMessages}
                    <div class="picker">
                        <DurationPicker bind:milliseconds={eventsTTL} />
                    </div>
                {/if}
            </div>
        </div>
        <div class="full-width-btn">
            <Button
                loading={saving}
                disabled={!dirty || saving}
                fill
                onClick={updateDirectChatDetails}
                ><Translatable resourceKey={i18nKey("update")} /></Button>
        </div>
    </div>
{/if}

<style lang="scss">
    .wrapper {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: 100%;
    }
    .user-form {
        @include nice-scrollbar();
        padding: $sp3 $sp5 0 $sp5;
        @include mobile() {
            padding: $sp3 $sp4 0 $sp4;
        }
        display: flex;
        flex-direction: column;
        gap: $sp4;
        align-items: center;
    }

    h4 {
        flex: 1;
        margin: 0;
        text-align: center;
        @include font-size(fs-120);
    }
    .close {
        flex: 0 0 30px;
    }

    .bio {
        overflow-wrap: anywhere;
    }

    .disappearing {
        align-self: flex-start;
    }

    .full-width-btn {
        align-self: stretch;
        margin-top: $sp4;
        padding: 0 $sp4 $sp4 $sp4;
        @include mobile() {
            padding: 0 $sp3 $sp3 $sp3;
        }
    }

    .controls {
        align-self: stretch;
        margin-bottom: $sp5;
    }

    .picker {
        margin-top: $sp3;
    }

    .user-form {
        :global(button.icon-button) {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: $sp4;
        }

        .profile-card {
            width: 100%;
            margin-bottom: $sp4;
        }

        :global(button.call-user) {
            background: var(--vote-yes-color);
            color: var(--toast-failure-txt);
            @media (hover: hover) {
                &:hover {
                    background: var(--darkened-call);
                }
            }
        }
    }
</style>
