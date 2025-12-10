<script lang="ts">
    import { Caption, ColourVars, CommonButton, Container, Sheet } from "component-lib";
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
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import Enter from "svelte-material-icons/LocationEnter.svelte";
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
    let hasGates = $derived(flattenedGates.length > 0);
    let locked = $derived(gates.some((g) => isLocked(g)));

    function joinGroup() {
        publish("joinGroup", {
            group: chat,
            select: false,
        });
    }

    function cancelPreview() {
        if (previewingCommunity && $selectedCommunitySummaryStore) {
            page(`/community/${$selectedCommunitySummaryStore.id.communityId}`);
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
    <Container gap={"sm"} direction={"vertical"} padding={"lg"} background={ColourVars.background1}>
        <Container crossAxisAlignment={"center"}>
            <Container>
                <CommonButton onClick={cancelPreview} size={"small_text"}>
                    {#snippet icon(color, size)}
                        <ArrowLeft {color} {size} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("back")} />
                </CommonButton>
            </Container>
            <CommonButton
                mode={"active"}
                loading={joining !== undefined}
                disabled={locked || joining !== undefined}
                onClick={joinGroup}>
                {#snippet icon(color, size)}
                    <Enter {color} {size} />
                {/snippet}
                <Translatable
                    resourceKey={locked
                        ? i18nKey("access.lockedGate", undefined, chat.level, true)
                        : lapsed
                          ? i18nKey("access.lapsed.rejoin", undefined, chat.level, true)
                          : i18nKey("joinGroup", undefined, chat.level, true)} />
            </CommonButton>
        </Container>
        {#if hasGates}
            <Container padding={["zero", "sm"]} mainAxisAlignment={"end"}>
                <Caption width={"hug"} fontWeight={"bold"} colour={"textSecondary"}>
                    <Translatable resourceKey={i18nKey("Access gates enabled")} />
                </Caption>
            </Container>
        {/if}
    </Container>
</Sheet>
