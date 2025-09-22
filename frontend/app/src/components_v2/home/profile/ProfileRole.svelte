<script lang="ts">
    import { type CommunitySummary, type Member, type MultiUserChat, ROLE_NONE } from "openchat-client";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import RoleIcon from "./RoleIcon.svelte";
    import WithRole from "./WithRole.svelte";

    interface Props {
        userId: string;
        community: CommunitySummary | undefined;
        chat: MultiUserChat | undefined;
        communityMembers: Map<string, Member>;
        chatMembers: Map<string, Member>;
    }

    let { userId, community, chat, communityMembers, chatMembers }: Props = $props();
</script>

<WithRole {userId} {chatMembers} {communityMembers}>
    {#snippet children(communityRole, chatRole)}
        <div class="wrapper">
            {#if community !== undefined && communityRole !== ROLE_NONE}
                <div class="role-col">
                    <Translatable
                        resourceKey={i18nKey(
                            "permissions.currentRole",
                            { role: communityRole },
                            "community",
                            false,
                        )} />
                    <RoleIcon level="community" role={communityRole} />
                </div>
            {/if}
            {#if chat !== undefined && chatRole !== ROLE_NONE}
                <div class="role-col">
                    <Translatable
                        resourceKey={i18nKey(
                            "permissions.currentRole",
                            { role: chatRole },
                            chat.level,
                            false,
                        )} />
                    <RoleIcon level={chat.level} role={chatRole} />
                </div>
            {/if}
        </div>
    {/snippet}
</WithRole>

<style lang="scss">
    .wrapper {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .role-col {
        @include font(light, normal, fs-60);
        display: flex;
        align-items: center;
        gap: $sp2;
        margin-bottom: $sp2;

        @include mobile() {
            @include font(light, normal, fs-90);
        }
    }
</style>
