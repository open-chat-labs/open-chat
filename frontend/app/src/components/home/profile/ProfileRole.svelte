<script lang="ts">
    import type { ChatSummary, CommunitySummary } from "openchat-client";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";

    export let community: CommunitySummary | undefined;
    export let chat: ChatSummary | undefined;
</script>

{#if community !== undefined}
    <div class="role-row">
        <Translatable
            resourceKey={i18nKey("permissions.currentRole", undefined, community.level)} />
        <span class="role">
            {community.membership.role}
        </span>
    </div>
{/if}
{#if chat !== undefined}
    <div class="role-row">
        <Translatable
            resourceKey={i18nKey(
                "permissions.currentRole",
                undefined,
                chat.kind === "group_chat" ? "group" : "channel",
            )} />
        <span class="role">
            {chat.membership.role}
        </span>
    </div>
{/if}

<style lang="scss">
    .role-row {
        @include font(light, normal, fs-60);
        display: flex;
        justify-content: space-between;
        align-items: center;

        @include mobile() {
            @include font(light, normal, fs-80);
            justify-content: space-evenly;
        }
    }

    .role {
        text-transform: uppercase;
        color: var(--accent);
        font-weight: 700;
    }
</style>
