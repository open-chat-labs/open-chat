<script lang="ts">
    import { menuCloser } from "component-lib";
    import type { OpenChat, RejectReason, TranslationCorrection } from "@client";
    import { allUsersStore, formatTokens, iconSize } from "@client";
    import { getContext, onDestroy, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import Check from "svelte-material-icons/Check.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import EyeOutline from "svelte-material-icons/EyeOutline.svelte";
    import Hamburger from "svelte-material-icons/Menu.svelte";
    import Refresh from "svelte-material-icons/Refresh.svelte";
    import Translate from "svelte-material-icons/Translate.svelte";
    import { reviewingTranslations } from "../../../i18n/i18n";
    import { TranslationCorrections } from "../../../logic/admin/translationCorrections.svelte";
    import { toastStore } from "../../../stores/toast";
    import HoverIcon from "../../HoverIcon.svelte";
    import Menu from "../../Menu.svelte";
    import MenuIcon from "../../MenuIcon.svelte";
    import MenuItem from "../../MenuItem.svelte";

    const client = getContext<OpenChat>("client");
    const review = new TranslationCorrections(client);

    let corrections = $derived(review.corrections);
    let refreshing = $derived(review.refreshing);
    let processing = $derived(review.processing);
    let verifying = $derived(review.verifying);
    let formattedBalance = $derived(formatTokens(review.chatBalance, 8));

    onMount(() => {
        reviewingTranslations.set(true);
        void review.load();
        refreshBalance();
    });

    onDestroy(() => reviewingTranslations.set(false));

    function refreshBalance() {
        void review.refreshBalance();
    }

    async function approveCorrection(correction: TranslationCorrection) {
        const outcome = await review.approve(correction);
        if (outcome.kind === "failed") toastStore.showFailureToast(outcome.message);
    }

    async function rejectCorrection(correction: TranslationCorrection, reason: RejectReason) {
        const outcome = await review.reject(correction, reason);
        if (outcome.kind === "failed") toastStore.showFailureToast(outcome.message);
    }

    function previewCorrection(correction: TranslationCorrection) {
        client.previewTranslationCorrection(correction.key, correction.value);
    }

    function verifyCorrection(correction: TranslationCorrection) {
        void review.verify(correction);
    }
</script>

<div class="balance">
    <div>CHAT balance</div>
    <div class="amount">{formattedBalance}</div>
    <div class="refresh" class:refreshing onclick={refreshBalance}>
        <Refresh size={"1em"} color={"var(--icon-txt)"} />
    </div>
</div>
<div use:menuCloser class="translation-corrections">
    <table class="data">
        <thead>
            <tr>
                <th class="locale">Locale</th>
                <th class="key">Key</th>
                <th class="english">English value</th>
                <th class="current">Current value</th>
                <th class="proposed">Suggested value</th>
                <th class="proposed_by">Proposed by</th>
                <th class="proposed_at">Proposed at</th>
                <th class="action"></th>
            </tr>
        </thead>
        <tbody>
            {#each corrections as correction}
                <tr>
                    <td class="locale">{correction.locale}</td>
                    <td class="key">{correction.key}</td>
                    <td class="english">{$_(correction.key, { locale: "en-GB" })}</td>
                    <td class="current">{$_(correction.key, { locale: correction.locale })}</td>
                    <td class="proposed">
                        {#if verifying !== undefined && verifying.id === correction.id}
                            {verifying.value}
                        {:else}
                            {correction.value}
                        {/if}
                    </td>
                    <td class="proposed_by"
                        >{$allUsersStore.get(correction.proposedBy)?.username ??
                            correction.proposedBy}</td>
                    <td class="proposed_at"
                        >{client.toDatetimeString(new Date(Number(correction.proposedAt)))}</td>
                    <td class="action">
                        <MenuIcon position="bottom" align="end">
                            {#snippet menuIcon()}
                                {#if processing.has(correction.id)}
                                    <div class="busy"></div>
                                {:else}
                                    <HoverIcon>
                                        <Hamburger size={$iconSize} color={"var(--txt)"} />
                                    </HoverIcon>
                                {/if}
                            {/snippet}
                            {#snippet menuItems()}
                                <Menu>
                                    <MenuItem onclick={() => previewCorrection(correction)}>
                                        {#snippet icon()}
                                            <EyeOutline
                                                size={$iconSize}
                                                color={"var(--icon-inverted-txt)"} />
                                        {/snippet}
                                        {#snippet text()}
                                            <span>Preview</span>
                                        {/snippet}
                                    </MenuItem>
                                    {#if verifying !== undefined && verifying.id === correction.id}
                                        <MenuItem onclick={() => review.showProposed()}>
                                            {#snippet icon()}
                                                <Translate
                                                    size={$iconSize}
                                                    color={"var(--icon-inverted-txt)"} />
                                            {/snippet}
                                            {#snippet text()}
                                                <span>Show proposed</span>
                                            {/snippet}
                                        </MenuItem>
                                    {:else}
                                        <MenuItem onclick={() => verifyCorrection(correction)}>
                                            {#snippet icon()}
                                                <Translate
                                                    size={$iconSize}
                                                    color={"var(--icon-inverted-txt)"} />
                                            {/snippet}
                                            {#snippet text()}
                                                <span>Show suggestion in English</span>
                                            {/snippet}
                                        </MenuItem>
                                    {/if}
                                    <MenuItem onclick={() => approveCorrection(correction)}>
                                        {#snippet icon()}
                                            <Check
                                                size={$iconSize}
                                                color={"var(--icon-inverted-txt)"} />
                                        {/snippet}
                                        {#snippet text()}
                                            <span>Approve</span>
                                        {/snippet}
                                    </MenuItem>
                                    <MenuItem
                                        onclick={() =>
                                            rejectCorrection(correction, "incorrect_meaning")}>
                                        {#snippet icon()}
                                            <Close
                                                size={$iconSize}
                                                color={"var(--icon-inverted-txt)"} />
                                        {/snippet}
                                        {#snippet text()}
                                            <span>Reject (meaning)</span>
                                        {/snippet}
                                    </MenuItem>
                                    <MenuItem
                                        onclick={() => rejectCorrection(correction, "too_long")}>
                                        {#snippet icon()}
                                            <Close
                                                size={$iconSize}
                                                color={"var(--icon-inverted-txt)"} />
                                        {/snippet}
                                        {#snippet text()}
                                            <span>Reject (layout)</span>
                                        {/snippet}
                                    </MenuItem>
                                </Menu>
                            {/snippet}
                        </MenuIcon>
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>

<style lang="scss">
    .translation-corrections {
        margin-top: $sp3;
        padding: 0 $sp4 $sp4 $sp4;
        flex: auto;
        @include nice-scrollbar();
    }

    .balance {
        display: flex;
        justify-content: flex-end;
        margin-right: $sp4;
        gap: 6px;

        .amount {
            @include font(bold, normal, fs-100, 22);
        }

        .refresh {
            @include font-size(fs-140);
            height: $sp5;
            width: $sp5;
            cursor: pointer;
            @include mobile() {
                height: 21.59px;
                width: 21.59px;
            }

            &.refreshing {
                @include spin();
            }
        }
    }

    table {
        width: 100%;
        border-collapse: collapse;
        min-width: 600px; // this will scroll horizontally on mobile
    }

    thead {
        position: sticky;
        top: 0;
        z-index: 1;
    }

    tbody {
        position: relative;
    }

    tr {
        border-bottom: 1px solid var(--bd);
        height: 56px;
    }

    td,
    th {
        border-right: 1px solid var(--bd);
        &:last-child {
            border-right: none;
        }
    }

    th,
    td {
        padding: $sp3;
        text-align: left;
        vertical-align: middle;
    }

    th {
        background: var(--button-bg);
        color: var(--button-txt);

        &.locale,
        &.action {
            width: 40px;
        }

        &.proposed_by,
        &.proposed_at {
            width: 150px;
        }
    }

    .busy {
        @include loading-spinner(1em, 0.5em, var(--button-spinner), "/assets/plain-spinner.svg");
    }
</style>
