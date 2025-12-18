<script lang="ts">
    import { groupPreviewState } from "@src/utils/preview.svelte";
    import { Caption, ColourVars, CommonButton, Container, Sheet } from "component-lib";
    import {
        type EnhancedAccessGate,
        isCompositeGate,
        isLeafGate,
        isLocked,
        type MultiUserChat,
        type OpenChat,
    } from "openchat-client";
    import { getContext } from "svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import Enter from "svelte-material-icons/LocationEnter.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import GateCheckFailed from "./access/AccessGateCheckFailed.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chat: MultiUserChat;
        lapsed: boolean;
    }

    let { chat, lapsed }: Props = $props();

    let gates = $derived(client.accessGatesForChat(chat));
    let flattenedGates = $derived.by<EnhancedAccessGate[]>(() => {
        return gates.flatMap((g) => {
            if (isCompositeGate(g)) {
                return g.gates.map((l) => ({
                    ...l,
                    level: g.level,
                    expiry: g.expiry,
                    collectionName: g.collectionName,
                }));
            }
            if (isLeafGate(g)) {
                return [g];
            }
            return [];
        });
    });
    let hasGates = $derived(flattenedGates.length > 0);
    let locked = $derived(gates.some((g) => isLocked(g)));
</script>

<Container gap={"sm"} direction={"vertical"} padding={"lg"} background={ColourVars.background1}>
    <Container crossAxisAlignment={"center"}>
        <Container>
            <CommonButton
                onClick={() => groupPreviewState.cancelPreview(client)}
                size={"small_text"}>
                {#snippet icon(color, size)}
                    <ArrowLeft {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("back")} />
            </CommonButton>
        </Container>
        <CommonButton
            mode={"active"}
            loading={groupPreviewState.joining !== undefined}
            disabled={locked || groupPreviewState.joining !== undefined}
            onClick={() => groupPreviewState.joinGroup(client)}>
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

{#if groupPreviewState.gateCheckFailed.length > 0}
    <Sheet onDismiss={() => groupPreviewState.reset()}>
        <GateCheckFailed onClose={() => groupPreviewState.reset()} />
    </Sheet>
{/if}
