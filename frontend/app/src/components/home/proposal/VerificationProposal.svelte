<script lang="ts">
    import { IDL } from "@dfinity/candid";
    import { _ } from "svelte-i18n";
    import Legend from "../../Legend.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Input from "../../Input.svelte";
    import Translatable from "../../Translatable.svelte";
    import {
        type CommunityMatch,
        type ExecuteGenericNervousSystemFunction,
        type GroupMatch,
    } from "openchat-client";
    import CommunityFinder from "./CommunityFinder.svelte";
    import GroupFinder from "./GroupFinder.svelte";
    import { fade } from "svelte/transition";
    import { Principal } from "@dfinity/principal";

    const MIN_LENGTH = 3;
    const MAX_LENGTH = 25;

    interface Props {
        type: "group" | "community";
        valid: boolean;
    }

    let { type, valid = $bindable() }: Props = $props();

    let selected = $state<GroupMatch | CommunityMatch | undefined>();
    let name = $state("");
    let nameValid = $derived(name.length >= MIN_LENGTH && name.length <= MAX_LENGTH);
    let isValid = $derived(selected !== undefined && nameValid);

    function selectMatch(match: GroupMatch | CommunityMatch | undefined) {
        selected = match;
        name = match?.name ?? "";
    }

    $effect(() => {
        if (valid !== isValid) {
            valid = isValid;
        }
    });

    function setCommunityValidityPayload(communityId: string, name: string): Uint8Array {
        return new Uint8Array(
            IDL.encode(
                [
                    IDL.Record({
                        community_id: IDL.Principal,
                        name: IDL.Text,
                    }),
                ],
                [
                    {
                        community_id: Principal.fromText(communityId),
                        name,
                    },
                ],
            ),
        );
    }

    function setGroupValidityPayload(groupId: string, name: string): Uint8Array {
        return new Uint8Array(
            IDL.encode(
                [
                    IDL.Record({
                        group_id: IDL.Principal,
                        name: IDL.Text,
                    }),
                ],
                [
                    {
                        group_id: Principal.fromText(groupId),
                        name,
                    },
                ],
            ),
        );
    }

    export function convertAction(): ExecuteGenericNervousSystemFunction | undefined {
        if (selected === undefined || !isValid) return undefined;

        switch (selected.kind) {
            case "community_match":
                return {
                    kind: "execute_generic_nervous_system_function",
                    functionId: BigInt(2006),
                    payload: setCommunityValidityPayload(selected.id.communityId, name),
                };
            case "group_match":
                return {
                    kind: "execute_generic_nervous_system_function",
                    functionId: BigInt(2007),
                    payload: setGroupValidityPayload(selected.chatId.groupId, name),
                };
        }
    }
</script>

<section>
    <Legend label={i18nKey("verified.choose", undefined, type, true)} />
    {#if type === "community"}
        <CommunityFinder onSelect={selectMatch}></CommunityFinder>
    {:else}
        <GroupFinder onSelect={selectMatch}></GroupFinder>
    {/if}

    {#if selected !== undefined}
        <section in:fade class="name">
            <Legend label={i18nKey("verified.preferredName")} />
            <Input
                autofocus
                disabled={selected === undefined}
                invalid={!nameValid}
                bind:value={name}
                minlength={MIN_LENGTH}
                maxlength={MAX_LENGTH}
                countdown
                placeholder={i18nKey("verified.preferredName")} />
            <p class="info">
                <Translatable resourceKey={i18nKey("verified.rename", undefined, type, true)}
                ></Translatable>
            </p>
        </section>
    {/if}
</section>

<style lang="scss">
    .info {
        color: var(--txt-light);
        @include font(light, normal, fs-80);
    }
</style>
