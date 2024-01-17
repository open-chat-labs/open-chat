<script lang="ts">
    import { locale, _ } from "svelte-i18n";
    import { editingLabel, i18nKey, supportedLanguages } from "../i18n/i18n";
    import Button from "./Button.svelte";
    import ButtonGroup from "./ButtonGroup.svelte";
    import ModalContent from "./ModalContent.svelte";
    import Overlay from "./Overlay.svelte";
    import Legend from "./Legend.svelte";
    import TextArea from "./TextArea.svelte";
    import { getContext } from "svelte";
    import { OpenChat } from "openchat-client";
    import ErrorMessage from "./ErrorMessage.svelte";

    const client = getContext<OpenChat>("client");

    let busy = false;
    let suggestion = "";

    $: yourLanguage = supportedLanguages.find((l) => l.code === $locale)?.name ?? "English";
    $: corrections = client.translationCorrectionsStore;
    $: userStore = client.userStore;
    $: englishValue = $editingLabel && $_($editingLabel.key, { locale: "en" });
    $: englishTokens = extractTokens(englishValue);
    $: tokenMismatch = !tokensMatch(suggestion, englishTokens);
    $: valid = suggestion !== "" && !tokenMismatch;
    $: existingCorrection =
        $locale && $editingLabel && $corrections[$locale]
            ? $corrections[$locale][$editingLabel.key]
            : undefined;
    $: correctedBy =
        existingCorrection !== undefined ? $userStore[existingCorrection?.proposedBy].username : "";

    function tokensMatch(suggestion: string, originalTokens: Set<string>): boolean {
        return setsAreEqual(extractTokens(suggestion), originalTokens);
    }

    function setsAreEqual(a: Set<string>, b: Set<string>) {
        return [...a].every((x) => b.has(x)) && [...b].every((x) => a.has(x));
    }

    function extractTokens(input?: string): Set<string> {
        const tokens = new Set<string>();
        if (input === undefined) return tokens;
        const regex = /{([^}]+)}/g;
        let match;
        while ((match = regex.exec(input)) !== null) {
            tokens.add(match[1]);
        }
        return tokens;
    }

    function close() {
        editingLabel.set(undefined);
    }

    function save() {
        if ($locale && $editingLabel) {
            busy = true;
            client
                .setTranslationCorrection($locale, $editingLabel.key, suggestion)
                .then(() => {
                    editingLabel.set(undefined);
                })
                .finally(() => (busy = false));
        }
    }
</script>

{#if $editingLabel !== undefined}
    <Overlay dismissible on:close={close}>
        <ModalContent on:close>
            <div class="header" slot="header">Suggest a translation correction</div>
            <div slot="body">
                <p>
                    The language you wish to submit a correction for is <span class="value"
                        >{yourLanguage}</span>
                </p>
                <p>
                    The English value is <span class="value">{englishValue}</span>
                </p>
                <p>The current translation is <span class="value">{$_($editingLabel.key)}</span></p>
                {#if existingCorrection !== undefined}
                    <p>
                        The current translation was provided by <span class="value"
                            >{correctedBy}</span>
                    </p>
                {/if}
                <Legend label={i18nKey("Your proposed translation is")}></Legend>
                <TextArea
                    minlength={1}
                    maxlength={1000}
                    disabled={busy}
                    bind:value={suggestion}
                    placeholder={i18nKey("Enter your suggestion")} />

                {#if suggestion !== "" && tokenMismatch}
                    <ErrorMessage>
                        Your suggested correction must contain the same &lbrace;tokens&rbrace; as
                        the original English text
                    </ErrorMessage>
                {/if}
            </div>
            <div slot="footer">
                <ButtonGroup>
                    <Button secondary on:click={close}>{"Cancel"}</Button>
                    <Button disabled={!valid} on:click={save}>{"Save"}</Button>
                </ButtonGroup>
            </div>
        </ModalContent>
    </Overlay>
{/if}

<style lang="scss">
    p {
        margin-bottom: $sp3;
    }

    .value {
        color: var(--accent);
        font-weight: 500;
    }
</style>
