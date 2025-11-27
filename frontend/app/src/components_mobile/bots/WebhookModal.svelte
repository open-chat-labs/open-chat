<script lang="ts">
    import { toastStore } from "@src/stores/toast";
    import { copyToClipboard } from "@src/utils/urls";
    import { BodySmall, Button, ColourVars, Container, Form, Input, Subtitle } from "component-lib";
    import {
        emptyWebhookInstance,
        OpenChat,
        publish,
        validBotComponentName,
        type FullWebhookDetails,
        type MultiUserChat,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Close from "svelte-material-icons/Close.svelte";
    import Webhook from "svelte-material-icons/Webhook.svelte";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import EditableAvatar from "../EditableAvatar.svelte";
    import Markdown from "../home/Markdown.svelte";
    import SlidingPageContent from "../home/SlidingPageContent.svelte";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        chat: MultiUserChat;
        webhook?: FullWebhookDetails;
    }

    let { chat, webhook = $bindable(emptyWebhookInstance()) }: Props = $props();

    let busy = $state(false);
    let busyUpdate = $state(false);
    let original = { ...webhook };
    let editing = $derived(webhook.id !== "");
    let nameDirty = $derived(original.name !== webhook.name);
    let avatarDirty = $derived(original.avatarUrl !== webhook.avatarUrl);
    let dirty = $derived(nameDirty || avatarDirty);
    let name_errors = $derived(validBotComponentName(webhook.name, 3));
    let valid = $derived(name_errors.length === 0);
    let url = $derived(client.webhookUrl(webhook, chat.id));

    let titleKey = $derived.by(() => {
        return editing
            ? i18nKey("webhook.updateTitle", { name: webhook.name })
            : i18nKey("webhook.registerTitle");
    });

    function register() {
        if (valid && dirty) {
            busy = true;
            client
                .registerWebhook(chat.id, webhook.name, webhook.avatarUrl)
                .then((success) => {
                    if (success === undefined) {
                        toastStore.showFailureToast(i18nKey("Unable to register webhook"));
                    } else {
                        publish("closeModalPage");
                    }
                })
                .finally(() => (busy = false));
        }
    }

    function update() {
        busyUpdate = true;
        if (valid && dirty) {
            client
                .updateWebhook(
                    chat.id,
                    webhook,
                    nameDirty ? webhook.name : undefined,
                    avatarDirty
                        ? webhook.avatarUrl !== undefined
                            ? { value: webhook.avatarUrl }
                            : "set_to_none"
                        : undefined,
                )
                .then((success) => {
                    if (!success) {
                        toastStore.showFailureToast(i18nKey("Unable to update webhook details"));
                    } else {
                        original = { ...webhook };
                    }
                })
                .finally(() => (busyUpdate = false));
        }
    }

    function regenerate() {
        busy = true;
        client
            .regenerateWebhook(chat.id, original.id)
            .then((success) => {
                if (success === undefined) {
                    toastStore.showFailureToast(i18nKey("Unable to regenerate webhook"));
                } else {
                    webhook.secret = success;
                    original.secret = success;
                }
            })
            .finally(() => (busy = false));
    }

    function onSubmit(e: Event) {
        e.preventDefault();
    }

    function avatarSelected(detail: { url: string; data: Uint8Array }) {
        webhook.avatarUrl = detail.url;
    }

    function copy() {
        copyToClipboard(url ?? "").then((success) => {
            if (success) {
                toastStore.showSuccessToast(i18nKey("copiedToClipboard"));
            } else {
                toastStore.showFailureToast(
                    i18nKey("failedToCopyToClipboard", {
                        url,
                    }),
                );
            }
        });
    }
</script>

<SlidingPageContent title={titleKey} subtitle={i18nKey(chat.name)}>
    <Container gap={"xxxl"} direction={"vertical"} padding={["xxl", "lg"]}>
        <Container
            crossAxisAlignment={"center"}
            borderRadius={"lg"}
            padding={"lg"}
            background={ColourVars.background1}
            gap={"lg"}>
            <Webhook color={ColourVars.textSecondary} size={"4rem"} />
            <Container direction={"vertical"}>
                <Subtitle fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Webhooks")} />
                </Subtitle>
                <BodySmall colour={"textSecondary"}>
                    <Markdown
                        text={interpolate(
                            $_,
                            i18nKey(
                                "Webhooks let you send external events to this group programmatically. Once registered, your group gets a URL you can use to forward events. Learn more in the [bots developer guide](https://github.com/open-chat-labs/open-chat-bots).",
                            ),
                        )}></Markdown>
                </BodySmall>
            </Container>
        </Container>
        <Form {onSubmit}>
            <Container crossAxisAlignment={"center"} direction={"vertical"} gap={"xl"}>
                <EditableAvatar
                    highlightBorder
                    size={"headline"}
                    image={webhook.avatarUrl}
                    onImageSelected={avatarSelected} />

                <Input
                    minlength={3}
                    maxlength={15}
                    disabled={editing}
                    error={name_errors.length > 0}
                    bind:value={webhook.name}
                    autofocus
                    placeholder={interpolate($_, i18nKey("Webhook name"))}>
                    {#snippet subtext()}
                        <Translatable
                            resourceKey={i18nKey(
                                "Must be unique in this chat and contain alphanumeric characters and underscores only (required)",
                            )} />
                    {/snippet}
                </Input>

                {#if !editing}
                    <Button
                        loading={busy}
                        disabled={busy || (!editing && (!valid || !dirty))}
                        onClick={register}>
                        {#snippet icon(color)}
                            <Webhook {color} />
                        {/snippet}
                        <Translatable resourceKey={i18nKey("Register webhook")} />
                    </Button>
                    <Button onClick={() => publish("closeModalPage")} secondary>
                        {#snippet icon(color)}
                            <Close {color} />
                        {/snippet}
                        <Translatable resourceKey={i18nKey("cancel")} />
                    </Button>
                {/if}
            </Container>
        </Form>

        <div class="body">
            <!-- <form onsubmit={onSubmit} class="webhook-form">
                <Legend label={i18nKey("webhook.avatarLabel")} />
                <div class="photo">
                    <EditableAvatar
                        size={"medium"}
                        image={webhook.avatarUrl}
                        onImageSelected={avatarSelected} />
                </div>

                <Legend
                    required
                    label={i18nKey("webhook.nameLabel")}
                    rules={editing ? i18nKey("webhook.nameRules") : undefined}></Legend>
                <ValidatingInput
                    minlength={3}
                    maxlength={15}
                    disabled={editing}
                    invalid={name_errors.length > 0}
                    placeholder={i18nKey("webhook.namePlaceholder")}
                    error={name_errors}
                    bind:value={webhook.name}>
                </ValidatingInput>
            </form> -->

            <!-- {#if step !== "register" && url !== undefined}
                {#if step === "update"}
                    <ButtonGroup>
                        <Button
                            onClick={update}
                            disabled={busyUpdate || !valid || !dirty}
                            loading={busyUpdate}
                            small={!$mobileWidth}
                            tiny={$mobileWidth}>
                            <Translatable resourceKey={i18nKey("webhook.updateAction")} />
                        </Button>
                    </ButtonGroup>
                {/if}
                <hr />
                <div class="url">
                    <div class="title">
                        <Translatable resourceKey={i18nKey("webhook.urlLabel")} />
                    </div>
                    <div class="copy" title={$_("copyToClipboard")} onclick={copy}>
                        <ContentCopy size={$iconSize} color={"var(--icon-txt)"} />
                    </div>
                </div>
                {url}
            {/if} -->
        </div>
        <!-- <div class="footer">
            <ButtonGroup>
                <Button secondary small={!$mobileWidth} tiny={$mobileWidth} onClick={onClose}>
                    <Translatable
                        resourceKey={step !== "register" && !dirty
                            ? i18nKey("close")
                            : i18nKey("cancel")} />
                </Button>
                <Button
                    onClick={step === "update" ? regenerate : step === "register" ? register : copy}
                    disabled={busy || (step === "register" && (!valid || !dirty))}
                    loading={busy}
                    small={!$mobileWidth}
                    tiny={$mobileWidth}>
                    <Translatable
                        resourceKey={step === "update"
                            ? i18nKey("webhook.regenerateAction")
                            : step === "register"
                              ? i18nKey("webhook.registerAction")
                              : i18nKey("copy")} />
                </Button>
            </ButtonGroup>
        </div> -->
    </Container>
</SlidingPageContent>

<style lang="scss">
    .webhook-form {
        :global(.input-wrapper) {
            margin-bottom: $sp5;
        }
    }
    .url {
        display: flex;
        align-items: center;
        gap: $sp3;
        margin-bottom: $sp5;

        .title {
            @include font(bold, normal, fs-130, 29);
            @include mobile() {
                @include font(bold, normal, fs-120, 29);
            }
        }

        .copy {
            display: flex;
            cursor: pointer;
        }
    }

    hr {
        margin: $sp5 0;
        color: var(--bd);
    }

    .photo {
        max-width: toRem(100);
        margin-bottom: $sp3;
    }
</style>
