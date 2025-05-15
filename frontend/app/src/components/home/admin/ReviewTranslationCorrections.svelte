<script lang="ts">
    import type {
        CandidateTranslations,
        OpenChat,
        RejectReason,
        TranslationCorrection,
    } from "openchat-client";
    import { userStore } from "openchat-client";
    import { getContext, onDestroy, onMount } from "svelte";
    import { _, locale } from "svelte-i18n";
    import Check from "svelte-material-icons/Check.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import EyeOutline from "svelte-material-icons/EyeOutline.svelte";
    import Hamburger from "svelte-material-icons/Menu.svelte";
    import Refresh from "svelte-material-icons/Refresh.svelte";
    import Translate from "svelte-material-icons/Translate.svelte";
    import { menuCloser } from "../../../actions/closeMenu";
    import { i18nKey, reviewingTranslations } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import HoverIcon from "../../HoverIcon.svelte";
    import Menu from "../../Menu.svelte";
    import MenuIcon from "../../MenuIcon.svelte";
    import MenuItem from "../../MenuItem.svelte";

    const client = getContext<OpenChat>("client");

    let corrections: TranslationCorrection[] = $state([]);
    let verifying: TranslationCorrection | undefined = $state(undefined);
    let verifications: Record<number, string> = {};
    let chatBalance = $state(0n);
    let refreshing = $state(false);
    let processing = $state(new Set<bigint>());

    let formattedBalance = $derived(client.formatTokens(chatBalance, 8));

    onMount(async () => {
        reviewingTranslations.set(true);
        await client.getProposedTranslationCorrections().then(async (res) => {
            corrections = await loadRequiredLocales(flattenCorrections(res));
        });
        refreshBalance();
    });

    onDestroy(() => reviewingTranslations.set(false));

    // Since the locales are lazy loaded, we need to determine the locales for which we have corrections
    // and trigger the loading of the current translations for each of those locales.
    async function loadRequiredLocales(
        corrections: TranslationCorrection[],
    ): Promise<TranslationCorrection[]> {
        const currentLocale = $locale;
        const locales = corrections.reduce((all, c) => {
            all.add(c.locale);
            return all;
        }, new Set<string>());
        for (const l of locales) {
            await locale.set(l);
        }
        await locale.set(currentLocale);
        return corrections;
    }

    function refreshBalance() {
        refreshing = true;
        client
            .refreshTranslationsBalance()
            .then((val) => (chatBalance = val))
            .finally(() => (refreshing = false));
    }

    function flattenCorrections(corrections: CandidateTranslations[]): TranslationCorrection[] {
        return corrections
            .flatMap((group) =>
                group.candidates.map((correction) => ({
                    id: correction.id,
                    locale: group.locale,
                    key: group.key,
                    value: correction.value,
                    proposedBy: correction.proposedBy,
                    proposedAt: correction.proposedAt,
                })),
            )
            .sort((a, b) => a.key.localeCompare(b.key));
    }

    function removeCorrection(id: bigint) {
        corrections = corrections.filter((c) => c.id !== id);
    }

    function approveCorrection({ id }: TranslationCorrection) {
        processing.add(id);
        processing = processing;
        client
            .approveTranslationCorrection(id)
            .then((success) => {
                if (success) {
                    removeCorrection(id);
                } else {
                    toastStore.showFailureToast(
                        i18nKey("Sorry we were unable to approve this correction"),
                    );
                }
            })
            .finally(() => {
                processing.delete(id);
                processing = processing;
            });
    }

    function rejectCorrection({ id }: TranslationCorrection, reason: RejectReason) {
        processing.add(id);
        processing = processing;
        client
            .rejectTranslationCorrection(id, reason)
            .then((success) => {
                if (success) {
                    removeCorrection(id);
                } else {
                    toastStore.showFailureToast(
                        i18nKey("Sorry we were unable to reject this correction"),
                    );
                }
            })
            .finally(() => {
                processing.delete(id);
                processing = processing;
            });
    }

    function previewCorrection(correction: TranslationCorrection) {
        client.previewTranslationCorrection(correction.key, correction.value);
    }

    function verifyCorrection(correction: TranslationCorrection) {
        verifying = { ...correction };
        verifying.value = "Translating to English ...";
        getEnglish(correction).then((english) => {
            verifying = { ...correction, value: english };
        });
    }

    function getEnglish(correction: TranslationCorrection) {
        const key = Number(correction.id);
        if (verifications[key]) {
            return Promise.resolve(verifications[key]);
        }
        const params = new URLSearchParams();
        params.append("q", correction.value);
        params.append("target", "en");
        params.append("format", "text");
        params.append("key", import.meta.env.OC_PUBLIC_TRANSLATE_API_KEY!);
        return fetch(`https://translation.googleapis.com/language/translate/v2?${params}`, {
            method: "POST",
        })
            .then((resp) => resp.json())
            .then(({ data: { translations } }) => {
                if (Array.isArray(translations) && translations.length > 0) {
                    verifications[key] = translations[0].translatedText;
                    return translations[0].translatedText;
                }
            })
            .catch((err) => {
                console.error("Couldn't get english translation: ", err);
                return "Unable to get english translation at the moment";
            });
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
                        >{userStore.get(correction.proposedBy)?.username ??
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
                                        <MenuItem onclick={() => (verifying = undefined)}>
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
        background-color: var(--button-bg);
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
