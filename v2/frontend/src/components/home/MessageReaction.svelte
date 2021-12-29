<script lang="ts">
    import { fade } from "svelte/transition";
    import type { UserLookup } from "../../domain/user/user";
    import { getContext } from "svelte";
    import { emojiDatabase } from "../../utils/emojis";
    import { rtlStore } from "../../stores/rtl";

    export let reaction: string;
    export let userIds: Set<string>;
    export let me: boolean;
    export let myUserId: string | undefined;
    
    let hover = false;
    let userLookup = getContext<UserLookup>("userLookup");

    $: selected = myUserId !== undefined ? userIds.has(myUserId) : false;
    $: usernames = hover ? buildReactionUsernames(userIds) : "";
    $: maxWidth = calculateMaxWidth(usernames.length);

    function buildReactionUsernames(userIds: Set<string>): string {
        let usernames = userIds.size < 100 
            ? Array.from(userIds, uid => [uid, userLookup[uid]?.username])
                .filter(([uid, username]) => (username !== undefined) && (uid !== myUserId))
                .map(([_, username]) => username)
                .join(", ")
            : "99+ people" ;

        return usernames + (selected 
            ? usernames.length === 0 
            ? "You (click to remove)" 
            : ", and you" 
            : "");
    }

    async function buildReactionSuffix(reaction: string): Promise<string | undefined> {
        const emoji = (await emojiDatabase.getEmojiByUnicodeOrName(reaction)) as any;
        return emoji ? `reacted with :${emoji.shortcodes[emoji.shortcodes.length - 1]}:` : undefined;
    }

    function calculateMaxWidth(numChars: number): number {
        return Math.min(300, Math.max(136, Math.sqrt(numChars) * 12.5));
    }
</script>

<div
    on:click
    on:mouseenter={() => { hover = true; }} 
    on:mouseleave={() => { hover = false; }}
    on:contextmenu|preventDefault={() => {}}
    class:selected
    class="message-reaction">
    {reaction}
    <span class="reaction-count">
        {userIds.size > 99 ? "99+" : userIds.size}
    </span>
    {#if hover}
        <div 
            transition:fade={{ duration: 100 }} 
            class="reaction-tooltip" 
            class:right={me != $rtlStore} 
            style={`max-width: ${maxWidth}px`}
        >
            <div class="reaction-tooltip-emoji">{reaction}</div>
            <div>
                <span class="usernames">{usernames}</span>
                {#await buildReactionSuffix(reaction) then value}
                {value}
                {/await}                
            </div>
            <div class="diamond"></div>
        </div>
    {/if}
</div>

<style type="text/scss">
    .message-reaction {
        @include pop();
        border-radius: $sp4;
        background-color: var(--reaction-bg);
        color: var(--reaction-txt);
        cursor: pointer;
        height: 30px;
        padding: $sp2;
        display: flex;
        justify-content: center;
        align-items: center;
        text-align: center;
        margin-left: 1px;
        margin-right: 1px;
        margin-bottom: $sp2;
        font-size: 120%;
        position: relative;

        &.selected {
            border: 2px solid var(--reaction-me);
            .reaction-tooltip {
                bottom: 30px;
            }
        }

        .reaction-count {
            @include font(book, normal, fs-60);
            margin-left: $sp2;
        }

        .reaction-tooltip {
            background-color: var(--menu-bg);
            @include z-index("popup-menu");
            border: 1px solid var(--menu-bd);
            box-shadow: var(--menu-sh);

            display: flex;
            flex-direction: column;
            align-items: center;
            word-wrap: normal;
            word-break: normal;
            position: absolute;
            left: -4px;
            bottom: 34px;
            font-size: 9px;
            width: max-content;
            max-width: 300px;
            padding: $sp3;
            border-radius: $sp3;
            pointer-events: none;

            &.right {
                left: auto;
                right: -4px;  
                
                .diamond {
                    right: 18px;
                    left: auto;
                }                
            }

            .reaction-tooltip-emoji {
                font-size: 32px;
            }

            .diamond {
                position: absolute;
                background-color: inherit;
                width: 8px;
                height: 8px;
                bottom: -5px;
                left: 18px;
                transform: rotate(45deg);
                border-right: 1px solid inherit;
                border-bottom: 1px solid inherit;
            }
        }

        .usernames {
            font-weight: bold;
        }
    }
</style>
