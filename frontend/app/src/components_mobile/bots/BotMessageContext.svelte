<script lang="ts">
    import { Caption, ColourVars, Container, Tooltip } from "component-lib";
    import { allUsersStore, AvatarSize, OpenChat, type CommandArg } from "openchat-client";
    import type { BotContextCommand } from "openchat-shared";
    import { getContext } from "svelte";
    import CogOutline from "svelte-material-icons/CogOutline.svelte";
    import Avatar from "../Avatar.svelte";
    import Typing from "../Typing.svelte";
    import Markdown from "../home/Markdown.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        botCommand: BotContextCommand;
        botName: string;
        finalised: boolean;
    }

    let { botCommand, finalised }: Props = $props();
    const MAX_COMMAND_LENGTH = 30;
    let paramValues = $derived(botCommand.args.map(paramValue));
    let paramsLength = $derived(paramValues.reduce((total, p) => total + p.length, 0));
    let paramMode: "truncated" | "full" = $derived(
        paramsLength > MAX_COMMAND_LENGTH ? "truncated" : "full",
    );
    let text = $derived.by(() => {
        if (paramMode === "truncated") {
            return `@UserId(${botCommand.initiator}) used **/${botCommand.name}**${
                botCommand.args.length > 0 ? " with " : ""
            }`;
        } else {
            return `@UserId(${botCommand.initiator}) used **/${botCommand.name}**`;
        }
    });
    let user = $derived($allUsersStore.get(botCommand.initiator));

    function paramValue(param: CommandArg): string {
        switch (param.kind) {
            case "boolean":
                return param.value?.toString() ?? "false";
            case "integer":
            case "decimal":
                return param.value?.toString() ?? "null";
            case "string":
                return param.value ?? "null";
            case "user":
                return param.userId ? $allUsersStore.get(param.userId)?.username ?? "null" : "null";
            case "dateTime":
                return param.value
                    ? client.toDatetimeString(new Date(Number(param.value)))
                    : "null";
        }
    }
</script>

<Container crossAxisAlignment={"center"} gap={"xs"} supplementalClass={"bot-context"}>
    {#if user}
        <Avatar url={client.userAvatarUrl(user)} userId={user.userId} size={AvatarSize.Tiny} />
    {/if}
    <Caption colour={"textSecondary"}>
        <Markdown {text} />
    </Caption>
    {#if botCommand.args.length > 0}
        {#if paramMode === "truncated"}
            <Tooltip position="right" align="middle">
                <div class="cog">
                    <CogOutline color={ColourVars.textSecondary} />
                </div>
                {#snippet popup()}
                    <div class="command-params">
                        {#each botCommand.args as param}
                            <div class="param">
                                <div class="name">{param.name}:</div>
                                <div class="value">{paramValue(param)}</div>
                            </div>
                        {/each}
                    </div>
                {/snippet}
            </Tooltip>
        {:else}
            {#each paramValues as param}
                <div class="inline-param">{param}</div>
            {/each}
        {/if}
    {/if}
    {#if !finalised}
        <Typing />
    {/if}
</Container>

<style lang="scss">
    :global(.bot-context) {
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
            flex-direction: column;

            .value {
                @include font(bold, normal, fs-50);
            }
        }
    }
</style>
