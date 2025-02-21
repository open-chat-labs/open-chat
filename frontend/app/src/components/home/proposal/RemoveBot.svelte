<script lang="ts">
    import { IDL } from "@dfinity/candid";
    import { _ } from "svelte-i18n";
    import Legend from "../../Legend.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import {
        type ExecuteGenericNervousSystemFunction,
        type ExternalBotLike,
    } from "openchat-client";
    import { Principal } from "@dfinity/principal";
    import BotExplorer from "../../bots/BotExplorer.svelte";
    import SelectedMatch from "./SelectedMatch.svelte";

    interface Props {
        valid: boolean;
    }

    let { valid = $bindable() }: Props = $props();

    let selected = $state<ExternalBotLike | undefined>(undefined);
    let isValid = $derived(selected !== undefined);

    function selectMatch(match: ExternalBotLike | undefined) {
        selected = match;
    }

    $effect(() => {
        if (valid !== isValid) {
            valid = isValid;
        }
    });

    function removeBotPayload(bot: ExternalBotLike): Uint8Array {
        return new Uint8Array(
            IDL.encode(
                [
                    IDL.Record({
                        bot_id: IDL.Principal,
                    }),
                ],
                [
                    {
                        bot_id: Principal.fromText(bot.id),
                    },
                ],
            ),
        );
    }

    export function convertAction(): ExecuteGenericNervousSystemFunction | undefined {
        if (selected === undefined || !isValid) return undefined;

        return {
            kind: "execute_generic_nervous_system_function",
            functionId: BigInt(1014),
            payload: removeBotPayload(selected),
        };
    }
</script>

<section>
    <Legend label={i18nKey("bots.manage.removeSearch")} />
    {#if selected !== undefined}
        <SelectedMatch onRemove={() => (selected = undefined)} match={selected}></SelectedMatch>
    {:else}
        <BotExplorer maxHeight={"450px"} fill onSelect={selectMatch}></BotExplorer>
    {/if}
</section>
