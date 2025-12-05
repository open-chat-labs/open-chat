<script lang="ts">
    import { gateLabel } from "@src/utils/access";
    import {
        Avatar,
        BodySmall,
        Chip,
        ColourVars,
        CommonButton,
        Container,
        Sheet,
        Subtitle,
    } from "component-lib";
    import {
        chatListScopeStore,
        type EnhancedAccessGate,
        isCompositeGate,
        isLeafGate,
        isLocked,
        mobileWidth,
        type MultiUserChat,
        type OpenChat,
        publish,
        ROLE_NONE,
        routeForScope,
        selectedCommunitySummaryStore,
    } from "openchat-client";
    import page from "page";
    import { getContext } from "svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chat: MultiUserChat;
        joining: MultiUserChat | undefined;
        lapsed: boolean;
    }

    let { chat, joining, lapsed }: Props = $props();

    let previewingCommunity = $derived(
        $selectedCommunitySummaryStore?.membership.role === ROLE_NONE ||
            $selectedCommunitySummaryStore?.membership.lapsed,
    );
    let gates = $derived(client.accessGatesForChat(chat));
    let flattenedGates = $derived.by<EnhancedAccessGate[]>(() => {
        return gates.flatMap((g) => {
            if (isCompositeGate(g)) {
                return g.gates.map((l) => ({ ...l, level: g.level, expiry: g.expiry }));
            }
            if (isLeafGate(g)) {
                return [g];
            }
            return [];
        });
    });
    let locked = $derived(gates.some((g) => isLocked(g)));

    function joinGroup() {
        publish("joinGroup", {
            group: chat,
            select: false,
        });
    }

    function cancelPreview() {
        if (previewingCommunity && $selectedCommunitySummaryStore) {
            client.removeCommunity($selectedCommunitySummaryStore.id);
            page(routeForScope(client.getDefaultScope()));
        } else {
            if (!chat.public) {
                client.declineInvitation(chat.id);
            }
            client.removePreviewedChat(chat.id);
            if ($mobileWidth || !client.selectDefaultChat(false)) {
                page(routeForScope($chatListScopeStore));
            }
        }
    }
</script>

<Sheet onDismiss={cancelPreview}>
    <Container direction={"vertical"} gap={"lg"} padding={"xl"}>
        <Container
            crossAxisAlignment={"center"}
            gap={"lg"}
            background={ColourVars.background1}
            borderRadius={"lg"}>
            <Avatar size={"lg"} url={client.groupAvatarUrl(chat)} />
            <Container direction={"vertical"} gap={"xxs"}>
                <Subtitle fontWeight={"bold"}>{chat.name}</Subtitle>
                <BodySmall width={"hug"} colour={"textSecondary"}>
                    {#if lapsed}
                        <Translatable
                            resourceKey={i18nKey(
                                "Your membership has lapsed. Click re-join to below to join the chat",
                            )} />
                    {:else}
                        <Translatable resourceKey={i18nKey("Click join below to join the chat")} />
                    {/if}
                </BodySmall>
            </Container>
        </Container>
        <Container wrap gap={"xs"}>
            {#each flattenedGates as gate}
                <Chip mode={"filter"}>
                    {#snippet icon(color)}
                        <Check {color} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey(gateLabel[gate.kind])}></Translatable>
                </Chip>
            {/each}
        </Container>
        <Container crossAxisAlignment={"end"} mainAxisAlignment={"end"} gap={"md"}>
            {#if !lapsed}
                <CommonButton onClick={cancelPreview}>
                    <Translatable resourceKey={i18nKey("close")} />
                </CommonButton>
            {/if}

            <CommonButton
                mode={"active"}
                loading={joining !== undefined}
                disabled={locked || joining !== undefined}
                onClick={joinGroup}>
                <Translatable
                    resourceKey={locked
                        ? i18nKey("access.lockedGate", undefined, chat.level, true)
                        : lapsed
                          ? i18nKey("access.lapsed.rejoin", undefined, chat.level, true)
                          : i18nKey("joinGroup", undefined, chat.level, true)} />
            </CommonButton>
        </Container>
    </Container>
</Sheet>
