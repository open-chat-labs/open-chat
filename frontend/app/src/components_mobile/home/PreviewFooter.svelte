<script lang="ts">
    import { groupJoin } from "@src/logic/join/joinFlow.svelte";
    import { previewingCommunity, requirementCount } from "@src/logic/join/previewBar";
    import { showJoinStep } from "@src/utils/join";
    import { navigate } from "@utils/navigation";
    import { Caption, ColourVars, CommonButton, Container, Sheet } from "component-lib";
    import {
        isLocked,
        type MultiUserChat,
        type OpenChat,
        selectedCommunitySummaryStore,
    } from "@client";
    import { getContext } from "svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import Enter from "svelte-material-icons/LocationEnter.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "@shared_components/Translatable.svelte";
    import GateCheckFailed from "./access/AccessGateCheckFailed.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chat: MultiUserChat;
        lapsed: boolean;
    }

    let { chat, lapsed }: Props = $props();

    let gates = $derived(client.accessGatesForChat(chat));
    // the suspended unique-person gate is no requirement
    let hasGates = $derived(requirementCount(gates, () => false) > 0);
    let locked = $derived(gates.some((g) => isLocked(g)));
    let joining = $derived(groupJoin.joining !== undefined);

    async function join() {
        showJoinStep(await groupJoin.join(client, chat), "group");
    }

    // Back from a channel of a community being previewed goes up to the community, whose own
    // preview has Back and Join (PreviewWrapper); otherwise it cancels the chat's preview
    function back() {
        if (chat.kind === "channel" && previewingCommunity($selectedCommunitySummaryStore)) {
            navigate(`/community/${chat.id.communityId}`);
        } else {
            navigate(client.cancelPreview(chat.id));
        }
    }
</script>

<!-- TODO check this section, in designs it was from edge to edge, but it's not rendered as such -->
<Container
    gap={"sm"}
    direction={"vertical"}
    padding={"lg"}
    borderRadius="md"
    background={ColourVars.surface1}>
    <Container crossAxisAlignment={"center"}>
        <Container>
            <CommonButton
                onClick={back}
                size={"small_text"}>
                {#snippet icon(color, size)}
                    <ArrowLeft {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("back")} />
            </CommonButton>
        </Container>
        <CommonButton
            mode={"active"}
            loading={joining}
            disabled={locked || joining}
            onClick={join}>
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

{#if groupJoin.gateCheckFailed.length > 0}
    <Sheet onDismiss={() => groupJoin.reset()}>
        <GateCheckFailed onClose={() => groupJoin.reset()} />
    </Sheet>
{/if}
