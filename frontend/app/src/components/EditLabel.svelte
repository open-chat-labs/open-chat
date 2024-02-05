<script lang="ts">
    import { locale, _ } from "svelte-i18n";
    import { editingLabel, i18nKey, supportedLanguages } from "../i18n/i18n";
    import Translate from "svelte-material-icons/Translate.svelte";
    import Button from "./Button.svelte";
    import ButtonGroup from "./ButtonGroup.svelte";
    import ModalContent from "./ModalContent.svelte";
    import Overlay from "./Overlay.svelte";
    import Legend from "./Legend.svelte";
    import TextArea from "./TextArea.svelte";
    import { getContext } from "svelte";
    import { OpenChat } from "openchat-client";
    import ErrorMessage from "./ErrorMessage.svelte";
    import { toastStore } from "../stores/toast";

    const client = getContext<OpenChat>("client");

    let busy = false;
    let suggestion = "";
    let saved = false;

    $: yourLanguage = supportedLanguages.find((l) => l.code === $locale)?.name ?? "English";
    $: englishValue = $editingLabel && $_($editingLabel.key, { locale: "en" });
    $: englishTokens = extractTokens(englishValue);
    $: tokenMismatch = !tokensMatch(suggestion, englishTokens);
    $: valid = suggestion !== "" && !tokenMismatch;

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
        saved = false;
        suggestion = "";
    }

    function save() {
        if ($locale && $editingLabel) {
            busy = true;
            client
                .proposeTranslationCorrection($locale, $editingLabel.key, suggestion)
                .then((resp) => {
                    if (resp === "success") {
                        saved = true;
                    } else {
                        if (resp === "already_proposed") {
                            toastStore.showFailureToast(
                                i18nKey("This correction has already been suggested"),
                            );
                        } else {
                            toastStore.showFailureToast(
                                i18nKey("Sorry we were unable to save your suggestion"),
                            );
                        }
                    }
                })
                .finally(() => (busy = false));
        }
    }
</script>

{#if $editingLabel !== undefined}
    <Overlay dismissible on:close={close}>
        <ModalContent on:close>
            <div class="header" slot="header">
                <Translate color={"var(--icon-txt)"} size="1em" />
                <span>Suggest a translation correction</span>
            </div>
            <div slot="body">
                {#if !saved}
                    <p>
                        The language you wish to submit a correction for is <span class="value"
                            >{yourLanguage}</span>
                    </p>
                    <p>
                        The English value is <span class="value">{englishValue}</span>
                    </p>
                    <p>
                        The current translation is <span class="value"
                            >{$_($editingLabel.key)}</span>
                    </p>
                    <Legend label={i18nKey("Your proposed translation is")}></Legend>
                    <TextArea
                        minlength={1}
                        maxlength={1000}
                        disabled={busy}
                        bind:value={suggestion}
                        placeholder={i18nKey("Enter your suggestion")} />

                    {#if suggestion !== "" && tokenMismatch}
                        <ErrorMessage>
                            Your suggested correction must contain the same &lbrace;tokens&rbrace;
                            as the original English text
                        </ErrorMessage>
                    {/if}
                {:else}
                    <div class="saved">
                        <p>
                            Thank you for your suggestion. Please review the UI with your new
                            suggestion in place. If you would like to make further changes just
                            repeat this process until you are happy.
                        </p>
                        <p>
                            Your suggestion will be reviewed by a platform operator and applied soon
                            if it is approved.
                        </p>
                        <p>
                            In the meantime it will appear locally for you unless / until you
                            refresh the page.
                        </p>
                    </div>
                {/if}
            </div>
            <div slot="footer">
                <ButtonGroup>
                    {#if saved}
                        <Button on:click={close}>{"Close"}</Button>
                    {:else}
                        <Button secondary on:click={close}>{"Cancel"}</Button>
                        <Button loading={busy} disabled={!valid} on:click={save}>{"Save"}</Button>
                    {/if}
                </ButtonGroup>
            </div>
        </ModalContent>
    </Overlay>
{/if}

<style lang="scss">
    p {
        margin-bottom: $sp4;
    }

    .value {
        color: var(--accent);
        font-weight: 500;
    }

    .header {
        display: flex;
        gap: $sp3;
    }
</style>
