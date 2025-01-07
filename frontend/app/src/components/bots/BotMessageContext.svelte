<script lang="ts">
    import {
        AvatarSize,
        OpenChat,
        userStore,
        type BotMessageContext,
        type SlashCommandParamInstance,
    } from "openchat-client";
    import Markdown from "../home/Markdown.svelte";
    import CogOutline from "svelte-material-icons/CogOutline.svelte";
    import Avatar from "../Avatar.svelte";
    import { getContext } from "svelte";
    import Typing from "../Typing.svelte";
    import TooltipWrapper from "../TooltipWrapper.svelte";
    import TooltipPopup from "../TooltipPopup.svelte";

    const client = getContext<OpenChat>("client");

    type SlashCommandInstance = {
        name: string;
        params: SlashCommandParamInstance[];
    };

    interface Props {
        botContext: BotMessageContext;
        botName: string;
    }

    let { botContext }: Props = $props();
    let commandInstance: SlashCommandInstance = $derived.by(() => {
        try {
            return JSON.parse(botContext.commandText);
        } catch {
            return {
                name: botContext.commandText.slice(1),
                params: [],
            };
        }
    });
    let text = $derived.by(() => {
        return `@UserId(${botContext.initiator}) used **/${commandInstance.name}**${
            commandInstance.params.length > 0 ? " with " : ""
        }`;
    });
    let user = $derived($userStore.get(botContext.initiator));

    function paramValue(param: SlashCommandParamInstance): string {
        switch (param.kind) {
            case "boolean":
                return param.value?.toString() ?? "false";
            case "number":
                return param.value?.toString() ?? "null";
            case "string":
                return param.value ?? "null";
            case "user":
                return param.userId ? $userStore.get(param.userId)?.username ?? "null" : "null";
        }
    }
</script>

<div class="bot-context">
    {#if user}
        <Avatar url={client.userAvatarUrl(user)} userId={user.userId} size={AvatarSize.Tiny} />
    {/if}
    <Markdown {text} />
    {#if commandInstance.params.length > 0}
        <TooltipWrapper position="right" align="middle">
            <div class="cog" slot="target">
                <CogOutline size={"1.2em"} color={"var(--icon-txt)"} />
            </div>
            <div let:position let:align slot="tooltip">
                <TooltipPopup {align} {position}>
                    <div class="command-params">
                        {#each commandInstance.params as param}
                            <div class="param">
                                <div class="name">{param.name}:</div>
                                <div class="value">{paramValue(param)}</div>
                            </div>
                        {/each}
                    </div>
                </TooltipPopup>
            </div>
        </TooltipWrapper>
    {/if}
    {#if !botContext.finalised}
        <Typing />
    {/if}
</div>

<style lang="scss">
    .bot-context {
        @include font(light, normal, fs-70);
        color: var(--txt-light);
        display: flex;
        gap: $sp2;
        align-items: center;

        .cog {
            display: flex;
        }
    }

    :global(.command-params) {
        word-wrap: unset;

        .param {
            display: flex;
            align-items: start;
            text-align: left;
            gap: $sp2;
            flex-wrap: nowrap;

            .value {
                @include font(bold, normal, fs-50);
            }
        }
    }
</style>
