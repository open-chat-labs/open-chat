<script lang="ts">
    import type { ChatSummary, CommunitySummary, Member } from "openchat-client";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";

    export let userId: string;
    export let community: CommunitySummary | undefined;
    export let chat: ChatSummary | undefined;
    export let communityMembers: Map<string, Member>;
</script>

{#if community !== undefined}
    <div class="role-row">
        <Translatable
            resourceKey={i18nKey("permissions.currentRole", undefined, community.level)} />
        <span class="role">
            <span class="role-txt">{communityMembers.get(userId)?.role}</span>
            <div class={`icon community ${communityMembers.get(userId)?.role}`}></div>
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
            <span class="role-txt">{chat.membership.role}</span>
            <div class={`icon chat ${chat.membership.role}`}></div>
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
        display: flex;
        align-items: center;
        gap: $sp2;

        .icon {
            width: 12px;
            height: 12px;
            flex: 0 0 12px;
            background-repeat: no-repeat;
            transform-origin: 50% 50%;
            transform: rotate(180deg);

            &.member {
                display: none;
            }

            &.community {
                &.owner {
                    background-image: url("/assets/community_owner.svg");
                }
                &.admin {
                    background-image: url("/assets/community_admin.svg");
                }
            }

            &.chat {
                &.owner {
                    background-image: url("/assets/chat_owner.svg");
                }
                &.admin {
                    background-image: url("/assets/chat_admin.svg");
                }
                &.moderator {
                    background-image: url("/assets/chat_moderator.svg");
                }
            }
        }
    }
</style>
