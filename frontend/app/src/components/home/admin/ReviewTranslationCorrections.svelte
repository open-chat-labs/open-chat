<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { OpenChat, TranslationCorrection, TranslationCorrections } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";

    const client = getContext<OpenChat>("client");

    $: userStore = client.userStore;

    let corrections: TranslationCorrection[] = [];
    let verifying: TranslationCorrection | undefined = undefined;

    let verifications: Record<string, string> = {};

    onMount(() => {
        client.getTranslationCorrections().then((res) => {
            corrections = flattenCorrections(res);
        });
    });

    function flattenCorrections(corrections: TranslationCorrections): TranslationCorrection[] {
        return Object.values(corrections)
            .flatMap((val) => Object.values(val))
            .filter((c) => !c.approved);
    }

    function approveCorrection(correction: TranslationCorrection) {
        client
            .approveTranslationCorrection(correction)
            .then((res) => (corrections = flattenCorrections(res)));
    }

    function rejectCorrection(correction: TranslationCorrection) {
        client
            .rejectTranslationCorrection(correction)
            .then((res) => (corrections = flattenCorrections(res)));
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
                <th>Locale</th>
                <th>Key</th>
                <th>English value</th>
                <th>Current value</th>
                <th>Proposed value</th>
                <th>Proposed by</th>
                <th>Proposed at</th>
            </tr>
        </thead>
        <tbody>
            {#each corrections as correction}
                <tr>
                    <td>{correction.locale}</td>
                    <td>{correction.key}</td>
                    <td>{$_(correction.key, { locale: "en" })}</td>
                    <td>{$_(correction.key, { locale: correction.locale })}</td>
                    <td>
                        <div class="suggestion">
                            {#if verifying !== undefined && verifying.locale === correction.locale && verifying.key === correction.key}
                                {verifying.value}
                            {:else}
                                {correction.value}
                            {/if}
                        </div>
                        <div class="review">
                            {#if verifying !== undefined && verifying.locale === correction.locale && verifying.key === correction.key}
                                <ButtonGroup align="fill">
                                    <Button secondary on:click={() => (verifying = undefined)} tiny
                                        >Show Proposed
                                    </Button>
                                    <Button tiny on:click={() => rejectCorrection(correction)}
                                        >Reject</Button>
                                    <Button tiny on:click={() => approveCorrection(correction)}
                                        >Approve</Button>
                                </ButtonGroup>
                            {:else}
                                <Button on:click={() => verifyCorrection(correction)} tiny
                                    >Show English
                                </Button>
                            {/if}
                        </div>
                    </td>
                    <td>{$userStore[correction.proposedBy]?.username ?? correction.proposedBy}</td>
                    <td>{client.toDatetimeString(new Date(correction.proposedAt))}</td>
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
    }

    th {
        background-color: var(--button-bg);
        color: var(--button-txt);
    }

    tr {
        cursor: pointer;
    }

    tr:hover {
        background-color: rgba(255, 255, 255, 0.1);
    }

    .suggestion {
        margin-bottom: $sp3;
    }
</style>
