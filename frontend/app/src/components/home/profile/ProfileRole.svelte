<script lang="ts">
    import type { ChatSummary, CommunitySummary, Member } from "openchat-client";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import RoleIcon from "./RoleIcon.svelte";
    import WithRole from "./WithRole.svelte";

    export let userId: string;
    export let community: CommunitySummary | undefined;
    export let chat: ChatSummary | undefined;
    export let communityMembers: Map<string, Member>;
    export let chatMembers: Map<string, Member>;
</script>

<WithRole {userId} {chatMembers} {communityMembers} let:communityRole let:chatRole>
    {#if community !== undefined}
        <div class="role-row">
            <Translatable
                resourceKey={i18nKey("permissions.currentRole", undefined, community.level)} />
            <span class="role">
                <span class="role-txt">{communityRole}</span>
                <RoleIcon roleType="community" role={communityRole} />
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
                <span class="role-txt">{chatRole}</span>
                <RoleIcon roleType="chat" role={chatRole} />
            </span>
        </div>
    {/if}
</WithRole>

<style lang="scss">
    .role-row {
        @include font(light, normal, fs-60);
        display: flex;
        justify-content: space-between;
        align-items: center;

        @include mobile() {
            @include font(light, normal, fs-90);
        }
    }

    .role {
        text-transform: uppercase;
        color: var(--accent);
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: $sp2;
    }
</style>
