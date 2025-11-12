<script lang="ts">
    import Translatable from "@src/components/Translatable.svelte";
    import Setting from "@src/components_mobile/Setting.svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import { toastStore } from "@src/stores/toast";
    import { activeVideoCall } from "@src/stores/video";
    import { Body, Button, ColourVars, Container, IconButton, Switch } from "component-lib";
    import type { DirectChatSummary, OptionUpdate, PublicProfile } from "openchat-client";
    import {
        allUsersStore,
        blockedUsersStore,
        chatIdentifiersEqual,
        favouritesStore,
        OpenChat,
        publish,
    } from "openchat-client";
    import { getContext, onDestroy, onMount } from "svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import CancelIcon from "svelte-material-icons/Cancel.svelte";
    import HeartMinus from "svelte-material-icons/HeartMinusOutline.svelte";
    import HeartPlus from "svelte-material-icons/HeartPlusOutline.svelte";
    import Video from "svelte-material-icons/VideoOutline.svelte";
    import DisappearingDuration from "../DisappearingDuration.svelte";
    import UserProfileSummaryCard from "../user_profile/UserProfileSummaryCard.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chat: DirectChatSummary;
    }

    let { chat }: Props = $props();

    let blocked = $derived($blockedUsersStore.has(chat.them.userId));
    let user = $derived($allUsersStore.get(chat.them.userId));
    let profile = $state<PublicProfile | undefined>();
    let eventsTTL = $state(chat.eventsTTL);
    let videoCallInProgress = $derived(chat.videoCallInProgress !== undefined);
    let blockLabel = $derived(blocked ? i18nKey("Unblock") : i18nKey("Block"));
    let blockTitle = $derived(blocked ? i18nKey("Unblock this user") : i18nKey("Block this user"));
    let blockInfo = $derived(
        blocked
            ? i18nKey(
                  "If you would like to allow this user to send you messages or viewing your profile or activity.",
              )
            : i18nKey(
                  "If you would like to prevent this user from sending you messages or viewing your profile or activity.",
              ),
    );
    let inCall = $derived(
        videoCallInProgress &&
            $activeVideoCall !== undefined &&
            chatIdentifiersEqual($activeVideoCall.chatId, chat.id),
    );

    onMount(() => {
        client.getPublicProfile(chat.them.userId).subscribe({
            onResult: (res) => {
                profile = res;
            },
        });
    });

    function getUpdate(): OptionUpdate<bigint> {
        if (eventsTTL !== undefined) {
            return { value: eventsTTL };
        } else if (chat.eventsTTL !== undefined) {
            return "set_to_none";
        } else {
            return undefined;
        }
    }

    onDestroy(async () => {
        if (eventsTTL !== chat.eventsTTL) {
            await client.updateDirectChatSettings(chat, getUpdate());
        }
    });

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

<Container background={ColourVars.background0} height={{ kind: "fill" }} direction={"vertical"}>
    {#if user !== undefined}
        <Container gap={"xl"} direction={"vertical"} padding={["lg", "md", "md", "md"]}>
            {#if profile}
                <UserProfileSummaryCard showChit={false} mode={"view"} {user} {profile}>
                    {#snippet buttons()}
                        <IconButton
                            onclick={() => publish("closeModalPage")}
                            size={"md"}
                            mode={"dark"}>
                            {#snippet icon(color)}
                                <ArrowLeft {color} />
                            {/snippet}
                        </IconButton>
                        <IconButton onclick={toggleFavourites} size={"md"} mode={"dark"}>
                            {#snippet icon(color)}
                                {#if !$favouritesStore.has(chat.id)}
                                    <HeartPlus {color} />
                                {:else}
                                    <HeartMinus {color} />
                                {/if}
                            {/snippet}
                        </IconButton>
                        <IconButton onclick={startVideoCall} size={"md"} mode={"dark"}>
                            {#snippet icon(color)}
                                <Video {color} />
                            {/snippet}
                        </IconButton>
                    {/snippet}
                </UserProfileSummaryCard>
            {/if}

            <div class="separator"></div>

            <Container gap={"md"} padding={["zero", "lg"]} direction={"vertical"}>
                <DisappearingDuration bind:eventsTTL>
                    {#snippet toggle(onToggle, enabled)}
                        <Setting
                            toggle={onToggle}
                            info={"A feature that automatically deletes messages after a set period, helping keep chats private and temporary."}>
                            <Switch
                                onChange={onToggle}
                                width={{ kind: "fill" }}
                                reverse
                                checked={enabled}>
                                <Translatable resourceKey={i18nKey("disappearingMessages.label")} />
                            </Switch>
                        </Setting>
                    {/snippet}
                </DisappearingDuration>
            </Container>

            <Container gap={"md"} padding={["zero", "lg"]} direction={"vertical"}>
                <Body fontWeight={"bold"}>
                    <Translatable resourceKey={blockTitle} />
                </Body>
                <Body colour={"textSecondary"}>
                    <Translatable resourceKey={blockInfo} />
                </Body>
                <Button secondary={blocked} width={{ kind: "fill" }} onClick={toggleBlocked}>
                    {#snippet icon(color)}
                        <CancelIcon {color} />
                    {/snippet}
                    <Translatable resourceKey={blockLabel} />
                </Button>
            </Container>
        </Container>
    {/if}
</Container>

<style lang="scss">
    .separator {
        height: 6px;
        align-self: stretch;
        background-color: var(--background-1);
        border-radius: var(--rad-circle);
        margin: 0 var(--sp-md);
    }
</style>
