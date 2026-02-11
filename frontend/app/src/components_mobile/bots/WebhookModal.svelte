<script lang="ts">
    import { toastStore } from "@src/stores/toast";
    import {
        BodySmall,
        Button,
        ColourVars,
        Container,
        CopyCard,
        Form,
        Input,
        Subtitle,
    } from "component-lib";
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
    import WebhookMember from "./WebhookMember.svelte";

    type Mode = "register" | "update" | "regenerate";

    const client = getContext<OpenChat>("client");

    interface Props {
        chat: MultiUserChat;
        webhook?: FullWebhookDetails;
        mode?: Mode;
    }

    let { mode = "register", chat, webhook = $bindable(emptyWebhookInstance()) }: Props = $props();

    let busy = $state(false);
    let original = { ...webhook };
    let nameDirty = $derived(original.name !== webhook.name);
    let avatarDirty = $derived(original.avatarUrl !== webhook.avatarUrl);
    let dirty = $derived(nameDirty || avatarDirty);
    let name_errors = $derived(validBotComponentName(webhook.name, 3));
    let valid = $derived(name_errors.length === 0);
    let url = $derived(client.webhookUrl(webhook, chat.id));
    let ctaText = $derived.by(() => {
        switch (mode) {
            case "update":
                return i18nKey("Update webhook");
            case "regenerate":
                return i18nKey("Regenerate webhook");
            case "register":
                return i18nKey("Register webhook");
        }
    });

    let titleKey = $derived.by(() => {
        switch (mode) {
            case "update":
                return i18nKey("webhook.updateTitle", { name: webhook.name });
            case "regenerate":
                return i18nKey("Regenerate webhook");
            case "register":
                return i18nKey("webhook.registerTitle");
        }
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
        busy = true;
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
                        publish("closeModalPage");
                    }
                })
                .finally(() => (busy = false));
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

    function mainAction() {
        switch (mode) {
            case "regenerate":
                return regenerate();
            case "register":
                return register();
            case "update":
                return update();
        }
    }

    function avatarSelected(detail: { url: string; data: Uint8Array }) {
        webhook.avatarUrl = detail.url;
    }
</script>

<SlidingPageContent title={titleKey} subtitle={i18nKey(chat.name)}>
    <Container gap={"xxxl"} direction={"vertical"} padding={["xxl", "lg"]}>
        {#if mode === "register"}
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
        {:else if mode === "regenerate" && url !== undefined}
            <Container gap={"lg"} direction={"vertical"}>
                <Container
                    padding={["md", "lg"]}
                    borderRadius={"lg"}
                    background={ColourVars.background1}>
                    <WebhookMember showMenu={false} {chat} {webhook} />
                </Container>
                <Container
                    padding={["md", "lg"]}
                    borderRadius={"lg"}
                    background={ColourVars.background1}>
                    <BodySmall>
                        <Translatable
                            resourceKey={i18nKey(
                                "If for any reason you may need to update your webhook URL, regenerating the webhook will update the “secret” part of the URL  and therefore effectively change it.",
                            )} />
                    </BodySmall>
                </Container>
                <CopyCard title={"Webhook URL"} body={url}></CopyCard>
            </Container>
        {:else if mode === "update" && url !== undefined}
            <CopyCard title={"Webhook URL"} body={url}></CopyCard>
        {/if}
        <Form {onSubmit}>
            <Container crossAxisAlignment={"center"} direction={"vertical"} gap={"xl"}>
                {#if mode !== "regenerate"}
                    <EditableAvatar
                        highlightBorder
                        size={"headline"}
                        image={webhook.avatarUrl}
                        onImageSelected={avatarSelected} />

                    <Input
                        minlength={3}
                        maxlength={15}
                        disabled={busy}
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
                {/if}

                {#if mode === "register" || mode === "update"}
                    <Button loading={busy} disabled={busy || !valid || !dirty} onClick={mainAction}>
                        {#snippet icon(color)}
                            <Webhook {color} />
                        {/snippet}
                        <Translatable resourceKey={ctaText} />
                    </Button>

                    <Button onClick={() => publish("closeModalPage")} secondary>
                        {#snippet icon(color)}
                            <Close {color} />
                        {/snippet}
                        <Translatable resourceKey={i18nKey("cancel")} />
                    </Button>
                {:else if mode === "regenerate"}
                    <Button loading={busy} disabled={busy} onClick={mainAction}>
                        {#snippet icon(color)}
                            <Webhook {color} />
                        {/snippet}
                        <Translatable resourceKey={ctaText} />
                    </Button>
                {/if}
            </Container>
        </Form>
    </Container>
</SlidingPageContent>
