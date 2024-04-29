<script lang="ts">
    import type { MemberRole } from "openchat-client";
    import TooltipPopup from "../../TooltipPopup.svelte";
    import TooltipWrapper from "../../TooltipWrapper.svelte";

    export let roleType: "community" | "chat";
    export let role: MemberRole | undefined;
    export let popup: boolean = false;
</script>

{#if role !== undefined && role !== "none" && role !== "member"}
    {#if popup}
        <TooltipWrapper position="top" align="middle">
            <div slot="target" class={`icon ${roleType} ${role}`}></div>
            <div let:position let:align slot="tooltip">
                <TooltipPopup {position} {align}>
                    {`${roleType.toUpperCase()} ${role?.toUpperCase()}`}
                </TooltipPopup>
            </div>
        </TooltipWrapper>
    {:else}
        <div class={`icon ${roleType} ${role}`}></div>
    {/if}
{/if}

<style lang="scss">
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
</style>
