<script lang="ts">
    import { type Level, type MemberRole, ROLE_MEMBER, roleAsText } from "openchat-client";
    import Tooltip from "../../../components/tooltip/Tooltip.svelte";

    interface Props {
        level: Level;
        role: MemberRole | undefined;
        popup?: boolean;
    }

    let { level, role, popup = false }: Props = $props();
    let roleText = role !== undefined ? roleAsText(role) : undefined;
</script>

{#if role !== undefined && role > ROLE_MEMBER}
    {#if popup}
        <Tooltip position="top" align="middle">
            <div class={`icon ${level} role=${roleText}`}></div>
            {#snippet popupTemplate()}
                {`${level.toUpperCase()} ${roleText?.toUpperCase()}`}
            {/snippet}
        </Tooltip>
    {:else}
        <div class={`icon ${level} ${role}`}></div>
    {/if}
{/if}

<style lang="scss">
    .icon {
        width: 15px;
        height: 14px;
        background-repeat: no-repeat;

        &.member {
            display: none;
        }

        &.community {
            &.owner {
                background-image: url("/assets/roles/community_owner.svg");
            }
            &.admin {
                background-image: url("/assets/roles/community_admin.svg");
            }
        }

        &.group,
        &.channel {
            &.owner {
                background-image: url("/assets/roles/chat_owner.svg");
            }
            &.admin {
                background-image: url("/assets/roles/chat_admin.svg");
            }
            &.moderator {
                background-image: url("/assets/roles/chat_moderator.svg");
            }
        }
    }
</style>
