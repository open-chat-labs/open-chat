<script lang="ts">
    import { toastStore } from "@src/stores/toast";
    import {
        emptyWebhookInstance,
        OpenChat,
        selectedChatId,
        ui,
        validBotComponentName,
        type MultiUserChatIdentifier,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import EditableAvatar from "../EditableAvatar.svelte";
    import Legend from "../Legend.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Translatable from "../Translatable.svelte";
    import ValidatingInput from "./ValidatingInput.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        onClose: () => void;
        mode: "register" | "update";
    }

    let { onClose, mode = "register" }: Props = $props();

    let busy = $state(false);
    let step: "choose" | "edit" = $state(mode === "update" ? "choose" : "edit");

    let webhookState = $state({
        original: emptyWebhookInstance(),
        current: emptyWebhookInstance(),
    });

    let nameDirty = $derived(webhookState.original.name !== webhookState.current.name);
    let avatarDirty = $derived(webhookState.original.avatarUrl !== webhookState.current.avatarUrl);
    let dirty = $derived(nameDirty || avatarDirty);
    let name_errors = $derived(validBotComponentName(webhookState.current.name, 3));
    let valid = $derived(name_errors.length === 0);

    let titleKey = $derived.by(() => {
        switch (mode) {
            case "register":
                return i18nKey("bots.register_webhook.title");
            case "update":
                return step === "choose"
                    ? i18nKey("bots.update_webhook.select")
                    : i18nKey("bots.update_webhook.title", { name: webhookState.current.name });
        }
    });

    function register() {
        if (webhookState.current !== undefined && valid && dirty) {
            busy = true;
            client
                .registerWebhook(
                    $selectedChatId as MultiUserChatIdentifier,
                    webhookState.current.name,
                    webhookState.current.avatarUrl,
                )
                .then((success) => {
                    if (!success) {
                        toastStore.showFailureToast(i18nKey("Unable to register webhook"));
                    } else {
                        console.log("Webhook registered");
                        onClose();
                    }
                })
                .finally(() => (busy = false));
        }
    }

    function update() {}

    function onSubmit(e: Event) {
        e.preventDefault();
    }

    function avatarSelected(detail: { url: string; data: Uint8Array }) {
        webhookState.current.avatarUrl = detail.url;
    }
</script>

<ModalContent {onClose}>
    {#snippet header()}
        <div class="header">
            <Translatable resourceKey={titleKey}></Translatable>
        </div>
    {/snippet}
    {#snippet body()}
        <div class="body">
            {#if step === "choose"}
                {#if !busy && mode === "update"}
                    CHOOSE WEBHOOK
                    <!-- <ChooseBot ownedOnly onSelect={selectBot} /> -->
                {/if}
            {:else if step === "edit" && webhookState.current !== undefined}
                <form onsubmit={onSubmit} class="bot">
                    <Legend label={i18nKey("bots.register_webhook.iconLabel")} />
                    <div class="photo">
                        <EditableAvatar
                            overlayIcon
                            size={"medium"}
                            image={webhookState.current.avatarUrl}
                            onImageSelected={avatarSelected} />
                    </div>

                    <Legend
                        required
                        label={i18nKey("bots.register_webhook.nameLabel")}
                        rules={i18nKey("bots.register_webhook.nameRules")}></Legend>
                    <ValidatingInput
                        minlength={3}
                        maxlength={25}
                        invalid={name_errors.length > 0}
                        placeholder={i18nKey("bots.register_webhook.namePlaceholder")}
                        error={name_errors}
                        bind:value={webhookState.current.name}>
                    </ValidatingInput>
                </form>
            {/if}
        </div>
    {/snippet}
    {#snippet footer()}
        <div class="footer">
            <ButtonGroup>
                <Button secondary small={!ui.mobileWidth} tiny={ui.mobileWidth} onClick={onClose}>
                    <Translatable resourceKey={i18nKey("cancel")} />
                </Button>
                <Button
                    onClick={mode === "update" ? update : register}
                    disabled={!valid || busy || !dirty}
                    loading={busy}
                    small={!ui.mobileWidth}
                    tiny={ui.mobileWidth}>
                    <Translatable
                        resourceKey={mode === "update"
                            ? i18nKey("bots.update_webhook.action")
                            : i18nKey("bots.register_webhook.action")} />
                </Button>
            </ButtonGroup>
        </div>
    {/snippet}
</ModalContent>

<style lang="scss">
    .photo {
        max-width: toRem(100);
        margin-bottom: $sp3;
    }
</style>
