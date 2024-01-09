<script lang="ts">
    import { locale, _ } from "svelte-i18n";
    import { editingLabel, supportedLanguages } from "../i18n/i18n";
    import Button from "./Button.svelte";
    import ButtonGroup from "./ButtonGroup.svelte";
    import ModalContent from "./ModalContent.svelte";
    import Overlay from "./Overlay.svelte";
    import Legend from "./Legend.svelte";
    import TextArea from "./TextArea.svelte";
    import { getContext } from "svelte";
    import { OpenChat } from "openchat-client";

    const client = getContext<OpenChat>("client");

    let busy = false;
    let suggestion = "";

    $: yourLanguage = supportedLanguages.find((l) => l.code === $locale)?.name ?? "English";
    $: corrections = client.translationCorrectionsStore;
    $: userStore = client.userStore;

    $: console.log("Corrections: ", $corrections);

    $: existingCorrection =
        $locale && $editingLabel && $corrections[$locale]
            ? $corrections[$locale][$editingLabel]
            : undefined;
    $: correctedBy =
        existingCorrection !== undefined ? $userStore[existingCorrection?.proposedBy].username : "";

    function close() {
        editingLabel.set(undefined);
    }

    function save() {
        if ($locale && $editingLabel) {
            busy = true;
            client
                .setTranslationCorrection($locale, $editingLabel, suggestion)
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
                    The English value is <span class="value"
                        >{$_($editingLabel, { locale: "en" })}</span>
                </p>
                <p>The current translation is <span class="value">{$_($editingLabel)}</span></p>
                {#if existingCorrection !== undefined}
                    <p>
                        The current translation was provided by <span class="value"
                            >{correctedBy}</span>
                    </p>
                {/if}
                <Legend label="Your proposed translation is"></Legend>
                <TextArea
                    minlength={1}
                    maxlength={1000}
                    disabled={busy}
                    bind:value={suggestion}
                    placeholder={"Enter your suggestion"} />
            </div>
            <div slot="footer">
                <ButtonGroup>
                    <Button secondary on:click={close}>{"Cancel"}</Button>
                    <Button on:click={save}>{"Save"}</Button>
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
