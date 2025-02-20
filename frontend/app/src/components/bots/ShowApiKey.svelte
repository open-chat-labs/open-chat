<script lang="ts">
    import AlertBox from "../AlertBox.svelte";
    import { interpolate } from "../../i18n/i18n";
    import Markdown from "../home/Markdown.svelte";
    import { _ } from "svelte-i18n";
    import {
        i18nKey,
        type ChatIdentifier,
        type CommunityIdentifier,
        type ExternalBotLike,
    } from "openchat-client";
    import ApiKey from "./ApiKey.svelte";

    interface Props {
        botExecutionContext: CommunityIdentifier | ChatIdentifier;
        bot: ExternalBotLike;
        apiKey: string;
    }

    let props: Props = $props();
</script>

<AlertBox>
    <div class="warning">
        <Markdown text={interpolate($_, i18nKey("bots.manage.copyKey"))} />
    </div>
    <ApiKey truncate={false} {...props} />
</AlertBox>

<style lang="scss">
    .warning {
        margin-bottom: $sp4;
    }
</style>
