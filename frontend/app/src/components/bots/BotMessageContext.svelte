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
    import { mobileWidth } from "../../stores/screenDimensions";

    const client = getContext<OpenChat>("client");

    interface Props {
        botContext: BotMessageContext;
        botName: string;
    }

    let { botContext }: Props = $props();
    let commandInstance = botContext.command;
    let MAX_COMMAND_LENGTH = $derived($mobileWidth ? 50 : 150);
    let paramValues = $derived(commandInstance.args.map(paramValue));
    let paramsLength = $derived(paramValues.reduce((total, p) => total + p.length, 0));
    let paramMode: "truncated" | "full" = $derived(
        paramsLength > MAX_COMMAND_LENGTH ? "truncated" : "full",
    );
    let text = $derived.by(() => {
        if (paramMode === "truncated") {
            return `@UserId(${botContext.command.initiator}) used **/${commandInstance.name}**${
                commandInstance.args.length > 0 ? " with " : ""
            }`;
        } else {
            return `@UserId(${botContext.command.initiator}) used **/${commandInstance.name}**`;
        }
    });
    let user = $derived($userStore.get(botContext.command.initiator));

    function paramValue(param: SlashCommandParamInstance): string {
        switch (param.kind) {
            case "boolean":
                return param.value?.toString() ?? "false";
            case "integer":
            case "decimal":
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
    {#if commandInstance.args.length > 0}
        {#if paramMode === "truncated"}
            <TooltipWrapper position="right" align="middle">
                <div class="cog" slot="target">
                    <CogOutline size={"1.2em"} color={"var(--icon-txt)"} />
                </div>
                <div let:position let:align slot="tooltip">
                    <TooltipPopup {align} {position}>
                        <div class="command-params">
                            {#each commandInstance.args as param}
                                <div class="param">
                                    <div class="name">{param.name}:</div>
                                    <div class="value">{paramValue(param)}</div>
                                </div>
                            {/each}
                        </div>
                    </TooltipPopup>
                </div>
            </TooltipWrapper>
        {:else}
            {#each paramValues as param}
                <div class="inline-param">{param}</div>
            {/each}
        {/if}
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
        @include ellipsis();

        :global(.markdown-wrapper) {
            @include ellipsis();
            flex-shrink: 0;
        }

        :global(.avatar.tiny) {
            flex: 0 0 toRem(20);
        }

        .cog {
            display: flex;
        }
    }

    .inline-param {
        // background-color: #efefef;
        padding: 0 $sp2;
        border-radius: $sp2;
        border: 1px solid var(--bd);
        @include font(light, normal, fs-60);
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
