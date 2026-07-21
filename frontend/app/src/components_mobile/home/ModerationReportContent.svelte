<script lang="ts">
    import {
        allUsersStore,
        MODERATION_CATEGORY_NAMES,
        platformModeratorStore,
        routeForMessage,
        type ModerationReportContent,
        type ModerationVerdict,
        type OpenChat,
    } from "@client";
    import Markdown from "@src/components_shared/Markdown.svelte";
    import { Body, BodySmall, Button, Column, Row, Subtitle } from "component-lib";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        content: ModerationReportContent;
    }

    let { content }: Props = $props();

    let busy = $state(false);
    let failed = $state(false);
    let resolved = $state(false);

    let moderatorId = $derived(
        content.status.kind !== "pending" ? content.status.moderator : undefined,
    );
    let moderator = $derived(
        moderatorId ? ($allUsersStore.get(moderatorId)?.username ?? moderatorId) : undefined,
    );
    let sender = $derived($allUsersStore.get(content.sender)?.username ?? content.sender);
    let reporters = $derived(content.reporters.map((r) => $allUsersStore.get(r)?.username ?? r));
    let csam = $derived((content.flaggedCategories & 2) !== 0);
    let categories = $derived(
        MODERATION_CATEGORY_NAMES.filter(([bit, _name]) => (content.flaggedCategories & bit) !== 0)
            .map(([_bit, name]) => name)
            .join(", "),
    );
    // Direct-chat routes resolve relative to the viewer, so a link to someone
    // else's private chat would be dead for moderators — show no link instead.
    let url = $derived(
        content.chatId.kind === "direct_chat"
            ? undefined
            : routeForMessage(
                  content.chatId.kind === "channel" ? "community" : "chats",
                  {
                      chatId: content.chatId,
                      threadRootMessageIndex: content.threadRootMessageIndex,
                  },
                  content.messageIndex,
              ),
    );
    let canResolve = $derived(
        $platformModeratorStore &&
            content.reportIndex !== undefined &&
            content.status.kind === "pending",
    );

    function resolve(verdict: ModerationVerdict) {
        if (content.reportIndex === undefined || busy || resolved) return;
        busy = true;
        failed = false;
        client.resolveModerationReport(content.reportIndex, verdict).then((success) => {
            busy = false;
            resolved = success;
            failed = !success;
        });
    }
</script>

<Column padding={["sm", "sm", "lg", "sm"]} gap="md">
    <Column>
        <Row gap="sm">
            {#if csam}
                <Subtitle width="hug" colour="error">
                    <Translatable resourceKey={i18nKey("moderationReport.csam")} />
                </Subtitle>
            {/if}
            <Subtitle>
                <Translatable resourceKey={i18nKey("moderationReport.title")} />
            </Subtitle>
        </Row>

        <BodySmall>
            {#if url !== undefined}
                <a class="link" href={url}
                    ><Translatable resourceKey={i18nKey("moderationReport.viewMessage")} /></a>
            {:else}
                <Translatable resourceKey={i18nKey("moderationReport.privateChat")} />
            {/if}
        </BodySmall>
    </Column>

    <Column gap="xs">
        <Body colour="textSecondary">
            <Translatable resourceKey={i18nKey("moderationReport.sender")} />: {sender}
        </Body>

        <Body colour="textSecondary">
            {#if reporters.length === 0}
                <Translatable resourceKey={i18nKey("moderationReport.pipeline")} />
            {:else}
                <Translatable resourceKey={i18nKey("moderationReport.reporters")} />: {reporters.join(
                    ", ",
                )}
            {/if}
        </Body>

        {#if categories !== ""}
            <Body colour="textSecondary">
                <Translatable resourceKey={i18nKey("moderationReport.categories")} />: {categories}
            </Body>
        {/if}
        {#if content.autoSanctioned}
            <Body colour="textSecondary">
                <Translatable resourceKey={i18nKey("moderationReport.autoSanctioned")} />
            </Body>
        {/if}
    </Column>

    {#if content.contentExcerpt !== undefined}
        <Row padding={["md", "zero"]}>
            <blockquote class="excerpt">
                <Markdown text={content.contentExcerpt} />
            </blockquote>
        </Row>
    {/if}

    {#if content.status.kind === "upheld" || content.status.kind === "upheld_as_csam"}
        <Body colour="textSecondary" fontWeight="bold">
            <Translatable
                resourceKey={i18nKey("moderationReport.upheld", {
                    moderator,
                })} />
        </Body>
    {:else if content.status.kind === "dismissed"}
        <Body colour="textSecondary" fontWeight="bold">
            <Translatable
                resourceKey={i18nKey("moderationReport.dismissed", {
                    moderator,
                })} />
        </Body>
    {:else if canResolve}
        <Row gap="sm" padding={["zero", "zero", "md", "zero"]}>
            <Button disabled={busy || resolved} loading={busy} onClick={() => resolve("upheld")}>
                <Translatable resourceKey={i18nKey("moderationReport.uphold")} />
            </Button>
            <Button
                danger
                disabled={busy || resolved}
                loading={busy}
                onClick={() => resolve("upheld_as_csam")}>
                <Translatable resourceKey={i18nKey("moderationReport.upholdCsam")} />
            </Button>
            <Button
                secondary
                disabled={busy || resolved}
                loading={busy}
                onClick={() => resolve("dismissed")}>
                <Translatable resourceKey={i18nKey("moderationReport.dismiss")} />
            </Button>
        </Row>
        {#if failed}
            <Body colour="error" fontWeight="bold">
                <Translatable resourceKey={i18nKey("moderationReport.failed")} />
            </Body>
        {/if}
    {/if}
</Column>

<style lang="scss">
    .link {
        color: var(--secondary) !important;
    }
    .excerpt {
        margin: 0;
        padding-left: var(--sp-sm);
        border-left: var(--sp-xs) solid var(--error);
        font-style: italic;
        white-space: pre-wrap;
    }
</style>
