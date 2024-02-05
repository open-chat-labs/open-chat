<script lang="ts">
    import { _ } from "svelte-i18n";
    import MenuIcon from "../../MenuIcon.svelte";
    import Hamburger from "svelte-material-icons/Menu.svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import EyeOutline from "svelte-material-icons/EyeOutline.svelte";
    import Translate from "svelte-material-icons/Translate.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import HoverIcon from "../../HoverIcon.svelte";
    import Menu from "../../Menu.svelte";
    import MenuItem from "../../MenuItem.svelte";
    import type {
        CandidateTranslations,
        OpenChat,
        RejectReason,
        TranslationCorrection,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { iconSize } from "../../../stores/iconSize";
    import { toastStore } from "../../../stores/toast";
    import { i18nKey } from "../../../i18n/i18n";

    const client = getContext<OpenChat>("client");

    $: userStore = client.userStore;

    let corrections: TranslationCorrection[] = [];
    let verifying: TranslationCorrection | undefined = undefined;

    let verifications: Record<string, string> = {};

    onMount(() => {
        client.getProposedTranslationCorrections().then((res) => {
            corrections = flattenCorrections(res);
        });
    });

    function flattenCorrections(corrections: CandidateTranslations[]): TranslationCorrection[] {
        return corrections.flatMap((group) =>
            group.candidates.map((correction) => ({
                id: correction.id,
                locale: group.locale,
                key: group.key,
                value: correction.value,
                proposedBy: correction.proposedBy,
                proposedAt: correction.proposedAt,
            })),
        );
    }

    function removeCorrection(id: bigint) {
        corrections = corrections.filter((c) => c.id !== id);
    }

    function approveCorrection({ id }: TranslationCorrection) {
        client.approveTranslationCorrection(id).then((success) => {
            if (success) {
                removeCorrection(id);
            } else {
                toastStore.showFailureToast(
                    i18nKey("Sorry we were unable to approve this correction"),
                );
            }
        });
    }

    function rejectCorrection({ id }: TranslationCorrection, reason: RejectReason) {
        client.rejectTranslationCorrection(id, reason).then((success) => {
            if (success) {
                removeCorrection(id);
            } else {
                toastStore.showFailureToast(
                    i18nKey("Sorry we were unable to reject this correction"),
                );
            }
        });
    }

    function previewCorrection(correction: TranslationCorrection) {
        // This will pretend that the value is english and apply it to the english i18n dictionary temporarily.
        // This is just so that we have the option to look at it in the UI to check for layout problems
        // client.previewTranslationCorrection({ ...correction, locale: "en" });
        console.log("preview: ", correction);
    }

    function verifyCorrection(correction: TranslationCorrection) {
        verifying = { ...correction };
        verifying.value = "Translating to English ...";
        getEnglish(correction).then((english) => {
            verifying = { ...correction, value: english };
        });
    }

    function getEnglish(correction: TranslationCorrection) {
        const key = `${correction.locale}_${correction.key}`;
        if (verifications[key]) {
            return Promise.resolve(verifications[key]);
        }
        const params = new URLSearchParams();
        params.append("q", correction.value);
        params.append("target", "en");
        params.append("format", "text");
        params.append("key", process.env.PUBLIC_TRANSLATE_API_KEY!);
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

<div class="translation-corrections">
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
                    <td class="english">{$_(correction.key, { locale: "en" })}</td>
                    <td class="current">{$_(correction.key, { locale: correction.locale })}</td>
                    <td class="proposed">
                        {#if verifying !== undefined && verifying.locale === correction.locale && verifying.key === correction.key}
                            {verifying.value}
                        {:else}
                            {correction.value}
                        {/if}
                    </td>
                    <td class="proposed_by"
                        >{$userStore[correction.proposedBy]?.username ?? correction.proposedBy}</td>
                    <td class="proposed_at"
                        >{client.toDatetimeString(new Date(Number(correction.proposedAt)))}</td>
                    <td class="action">
                        <MenuIcon position="bottom" align="end">
                            <span slot="icon">
                                <HoverIcon>
                                    <Hamburger size={$iconSize} color={"var(--txt)"} />
                                </HoverIcon>
                            </span>
                            <span slot="menu">
                                <Menu>
                                    <MenuItem on:click={() => previewCorrection(correction)}>
                                        <EyeOutline
                                            size={$iconSize}
                                            color={"var(--icon-inverted-txt)"}
                                            slot="icon" />
                                        <span slot="text">Preview</span>
                                    </MenuItem>
                                    {#if verifying !== undefined && verifying.locale === correction.locale && verifying.key === correction.key}
                                        <MenuItem on:click={() => (verifying = undefined)}>
                                            <Translate
                                                size={$iconSize}
                                                color={"var(--icon-inverted-txt)"}
                                                slot="icon" />
                                            <span slot="text">Show proposed</span>
                                        </MenuItem>
                                    {:else}
                                        <MenuItem on:click={() => verifyCorrection(correction)}>
                                            <Translate
                                                size={$iconSize}
                                                color={"var(--icon-inverted-txt)"}
                                                slot="icon" />
                                            <span slot="text">Show suggestion in English</span>
                                        </MenuItem>
                                    {/if}
                                    <MenuItem on:click={() => approveCorrection(correction)}>
                                        <Check
                                            size={$iconSize}
                                            color={"var(--icon-inverted-txt)"}
                                            slot="icon" />
                                        <span slot="text">Approve</span>
                                    </MenuItem>
                                    <MenuItem
                                        on:click={() =>
                                            rejectCorrection(correction, "incorrect_meaning")}>
                                        <Close
                                            size={$iconSize}
                                            color={"var(--icon-inverted-txt)"}
                                            slot="icon" />
                                        <span slot="text">Reject (meaning)</span>
                                    </MenuItem>
                                    <MenuItem
                                        on:click={() => rejectCorrection(correction, "too_long")}>
                                        <Close
                                            size={$iconSize}
                                            color={"var(--icon-inverted-txt)"}
                                            slot="icon" />
                                        <span slot="text">Reject (layout)</span>
                                    </MenuItem>
                                </Menu>
                            </span>
                        </MenuIcon>
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>

<style lang="scss">
    .translation-corrections {
        padding: $sp4;
    }

    tbody {
        position: relative;
    }

    thead {
        position: sticky;
        top: 0;
        z-index: 1;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        min-width: 600px; // this will scroll horizontally on mobile
    }

    tr {
        border-bottom: 1px solid var(--bd);

        &.pending {
            background-color: #e91e63;
        }
        &.approved {
            background-color: #66bb6a;
        }
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

    .suggestion {
        margin-bottom: $sp3;
    }
</style>
