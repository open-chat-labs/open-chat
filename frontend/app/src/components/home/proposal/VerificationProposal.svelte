<script lang="ts">
    import { _ } from "svelte-i18n";
    import Legend from "../../Legend.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Input from "../../Input.svelte";
    import Translatable from "../../Translatable.svelte";
    import { type GroupChatSummary, type CommunityMatch } from "openchat-client";
    import CommunityFinder from "./CommunityFinder.svelte";
    import { fade } from "svelte/transition";

    const MIN_LENGTH = 3;
    const MAX_LENGTH = 25;

    interface Props {
        type: "group" | "community";
    }

    let { type }: Props = $props();

    let selected = $state<GroupChatSummary | CommunityMatch | undefined>();
    let name = $state("");
    let nameValid = $derived(name.length >= MIN_LENGTH && name.length <= MAX_LENGTH);

    function selectMatch(match: GroupChatSummary | CommunityMatch | undefined) {
        selected = match;
        name = match?.name ?? "";
    }
</script>

<section>
    <Legend label={i18nKey("verified.choose", undefined, type, true)} />
    {#if type === "community"}
        <CommunityFinder onSelect={selectMatch}></CommunityFinder>
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
