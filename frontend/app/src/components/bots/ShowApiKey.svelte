<script lang="ts">
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

<div class="warning">
    <Markdown text={interpolate($_, i18nKey("bots.manage.copyKey"))} />
</div>
<ApiKey {...props} />

<style lang="scss">
    .warning {
        margin-bottom: $sp4;
    }
</style>
