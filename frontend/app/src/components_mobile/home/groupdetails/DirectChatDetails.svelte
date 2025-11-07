<script lang="ts">
    import HeartMinus from "@src/components/icons/HeartMinus.svelte";
    import HeartPlus from "@src/components/icons/HeartPlus.svelte";
    import Translatable from "@src/components/Translatable.svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import { activeVideoCall } from "@src/stores/video";
    import { Body, CommonButton, Container, IconButton, Switch } from "component-lib";
    import type { DirectChatSummary, OptionUpdate, PublicProfile } from "openchat-client";
    import {
        allUsersStore,
        blockedUsersStore,
        chatIdentifiersEqual,
        favouritesStore,
        OpenChat,
        publish,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import CancelIcon from "svelte-material-icons/Cancel.svelte";
    import Save from "svelte-material-icons/ContentSaveOutline.svelte";
    import PhoneHangup from "svelte-material-icons/PhoneHangup.svelte";
    import DurationPicker from "../DurationPicker.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import UserProfileSummaryCard from "../user_profile/UserProfileSummaryCard.svelte";

    const client = getContext<OpenChat>("client");
    const ONE_WEEK = 604800000n;

    interface Props {
        chat: DirectChatSummary;
    }

    let { chat }: Props = $props();

    let blocked = $derived($blockedUsersStore.has(chat.them.userId));
    let user = $derived($allUsersStore.get(chat.them.userId));
    let profile = $state<PublicProfile | undefined>();
    let disappearingMessages = $state(chat.eventsTTL !== undefined);
    let eventsTTL = $state(chat.eventsTTL);
    let originalTTL = $state(chat.eventsTTL);
    let saving = $state(false);
    let dirty = $derived(eventsTTL !== chat.eventsTTL);
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

    onMount(() => {
        client.getPublicProfile(chat.them.userId).subscribe({
            onResult: (res) => {
                profile = res;
            },
        });
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

    function toggleFavourites() {
        if ($favouritesStore.has(chat.id)) {
            client.removeFromFavourites(chat.id);
        } else {
            client.addToFavourites(chat.id);
        }
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

<SlidingPageContent title={i18nKey("Direct chat")}>
    {#snippet avatar()}
        <IconButton onclick={toggleFavourites}>
            {#snippet icon()}
                {#if !$favouritesStore.has(chat.id)}
                    <HeartPlus color={"var(--menu-warn)"} />
                {:else}
                    <HeartMinus color={"var(--menu-warn)"} />
                {/if}
            {/snippet}
        </IconButton>
    {/snippet}

    {#if user !== undefined}
        <Container gap={"lg"} direction={"vertical"} padding={"lg"}>
            {#if profile}
                <UserProfileSummaryCard mode={"view"} {user} {profile}></UserProfileSummaryCard>
            {/if}
            <Container mainAxisAlignment={"center"} gap={"md"}>
                <CommonButton width={{ kind: "fill" }} mode={"active"} onClick={startVideoCall}>
                    {#snippet icon(color, size)}
                        <PhoneHangup {color} {size} />
                    {/snippet}
                    <Translatable resourceKey={videoMenuText} />
                </CommonButton>
                <CommonButton width={{ kind: "fill" }} mode={"active"} onClick={toggleBlocked}>
                    {#snippet icon(color, size)}
                        <CancelIcon {color} {size} />
                    {/snippet}
                    <Translatable resourceKey={blockLabel} />
                </CommonButton>
            </Container>
            <Container gap={"lg"} direction={"vertical"}>
                <Switch onChange={toggleDisappearingMessages} checked={disappearingMessages}>
                    <Body>
                        <Translatable resourceKey={i18nKey("disappearingMessages.label")} />
                    </Body>
                </Switch>
                {#if disappearingMessages}
                    <DurationPicker bind:milliseconds={eventsTTL} />
                {/if}
            </Container>
            <Container mainAxisAlignment={"end"}>
                <CommonButton
                    onClick={updateDirectChatDetails}
                    loading={saving}
                    disabled={!dirty || saving}
                    mode={"active"}
                    size={"medium"}>
                    {#snippet icon(color, size)}
                        <Save {color} {size} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("update")} />
                </CommonButton>
            </Container>
        </Container>
    {/if}
</SlidingPageContent>
