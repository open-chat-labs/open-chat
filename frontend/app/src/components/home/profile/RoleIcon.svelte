<script lang="ts">
    import type { Level, MemberRole } from "openchat-client";
    import TooltipPopup from "../../TooltipPopup.svelte";
    import TooltipWrapper from "../../TooltipWrapper.svelte";

    export let level: Level;
    export let role: MemberRole | undefined;
    export let popup: boolean = false;
</script>

{#if role !== undefined && role !== "none" && role !== "member"}
    {#if popup}
        <TooltipWrapper position="top" align="middle">
            <div slot="target" class={`icon ${level} ${role}`}></div>
            <div let:position let:align slot="tooltip">
                <TooltipPopup {position} {align}>
                    {`${level.toUpperCase()} ${role?.toUpperCase()}`}
                </TooltipPopup>
            </div>
        </TooltipWrapper>
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
