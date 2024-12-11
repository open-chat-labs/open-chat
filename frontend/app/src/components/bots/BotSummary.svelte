<script lang="ts">
    import {
        AvatarSize,
        emptyPermissions,
        OpenChat,
        type BotMatch,
        type CommunitySummary,
        type SlashCommandPermissions,
    } from "openchat-client";
    import Avatar from "../Avatar.svelte";
    import { getContext } from "svelte";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Button from "../Button.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import TooltipWrapper from "../TooltipWrapper.svelte";
    import TooltipPopup from "../TooltipPopup.svelte";
    import Legend from "../Legend.svelte";
    import BotPermissionsTabs from "./BotPermissionsTabs.svelte";
    import Checkbox from "../Checkbox.svelte";
    import { togglePermission } from "../../utils/bots";
    import { toastStore } from "../../stores/toast";

    const client = getContext<OpenChat>("client");

    interface Props {
        bot: BotMatch;
        onClose: () => void;
        community: CommunitySummary;
    }

    let { bot, onClose, community }: Props = $props();
    let adding = $state(false);
    let requestedPermissions = $derived(flattenPermissions());
    let grantedPermissions = $state(flattenPermissions());
    let collapsed = $state(true);

    function hasEveryPermission<P extends keyof SlashCommandPermissions>(
        required: SlashCommandPermissions,
        granted: SlashCommandPermissions,
        prop: P,
    ): boolean {
        const r = required[prop] as SlashCommandPermissions[P][number][];
        const g = granted[prop] as SlashCommandPermissions[P][number][];
        return r.every((p) => g.includes(p));
    }

    function permitted(required: SlashCommandPermissions): boolean {
        return (
            hasEveryPermission(required, grantedPermissions, "chatPermissions") &&
            hasEveryPermission(required, grantedPermissions, "communityPermissions") &&
            hasEveryPermission(required, grantedPermissions, "messagePermissions") &&
            hasEveryPermission(required, grantedPermissions, "threadPermissions")
        );
    }

    function flattenPermissions() {
        return bot.commands.reduce((p, c) => {
            return mergePermissions(p, c.permissions);
        }, emptyPermissions());
    }

    function mergeLists<T>(l1: T[], l2: T[]): T[] {
        return [...new Set([...l1, ...l2])];
    }

    function mergePermissions(
        p1: SlashCommandPermissions,
        p2: SlashCommandPermissions,
    ): SlashCommandPermissions {
        return {
            chatPermissions: mergeLists(p1.chatPermissions, p2.chatPermissions),
            communityPermissions: mergeLists(p1.communityPermissions, p2.communityPermissions),
            messagePermissions: mergeLists(p1.messagePermissions, p2.messagePermissions),
            threadPermissions: mergeLists(p1.threadPermissions, p2.threadPermissions),
        };
    }

    function addBot() {
        adding = true;
        client
            .addBotToCommunity(community.id, bot.id, $state.snapshot(grantedPermissions))
            .then((success) => {
                if (!success) {
                    toastStore.showFailureToast(i18nKey("bots.add.failure"));
                } else {
                    onClose();
                }
            })
            .finally(() => (adding = false));
    }
</script>

<Overlay dismissible>
    <ModalContent closeIcon on:close={onClose}>
        <div class="header" slot="header">
            <Translatable resourceKey={i18nKey("bots.add.title")}></Translatable>
        </div>
        <div class="body" slot="body">
            <span class="avatar">
                <Avatar url={bot.avatarUrl} size={AvatarSize.Default} />
            </span>
            <div class="details">
                <h4 class="bot-name">
                    {bot.name}
                </h4>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <p
                    title={bot.description}
                    class="bot-desc"
                    class:collapsed
                    onclick={() => (collapsed = !collapsed)}>
                    {bot.description}
                </p>
                <div class="commands">
                    {#each bot.commands as command}
                        <TooltipWrapper position="bottom" align="middle">
                            <div
                                slot="target"
                                class="command"
                                class:not_permitted={!permitted(command.permissions)}>
                                {command.name}
                            </div>
                            <div let:position let:align slot="tooltip">
                                <TooltipPopup {align} {position}>
                                    {command.description}
                                </TooltipPopup>
                            </div>
                        </TooltipWrapper>
                    {/each}
                </div>
                <div class="permissions">
                    <Legend label={i18nKey("bots.add.choosePermissions")}></Legend>
                    <p class="info">
                        <Translatable resourceKey={i18nKey("bots.add.permissionsInfo")}
                        ></Translatable>
                    </p>
                    <BotPermissionsTabs>
                        {#snippet chatTab()}
                            {#if requestedPermissions.chatPermissions.length === 0}
                                <Translatable resourceKey={i18nKey("bots.add.noPermissions")}
                                ></Translatable>
                            {:else}
                                {#each requestedPermissions.chatPermissions as perm}
                                    <Checkbox
                                        id={`chat_permission_${perm}`}
                                        label={i18nKey(`permissions.${perm}`)}
                                        checked={grantedPermissions.chatPermissions.includes(perm)}
                                        on:change={() =>
                                            togglePermission(
                                                grantedPermissions,
                                                "chatPermissions",
                                                perm,
                                            )}
                                        align={"start"}>
                                    </Checkbox>
                                {/each}
                            {/if}
                        {/snippet}
                        {#snippet communityTab()}
                            {#if requestedPermissions.communityPermissions.length === 0}
                                <Translatable resourceKey={i18nKey("bots.add.noPermissions")}
                                ></Translatable>
                            {:else}
                                {#each requestedPermissions.communityPermissions as perm}
                                    <Checkbox
                                        id={`community_permission_${perm}`}
                                        label={i18nKey(`permissions.${perm}`)}
                                        checked={grantedPermissions.communityPermissions.includes(
                                            perm,
                                        )}
                                        on:change={() =>
                                            togglePermission(
                                                grantedPermissions,
                                                "communityPermissions",
                                                perm,
                                            )}
                                        align={"start"}>
                                    </Checkbox>
                                {/each}
                            {/if}
                        {/snippet}
                        {#snippet messageTab()}
                            {#if requestedPermissions.messagePermissions.length === 0}
                                <Translatable resourceKey={i18nKey("bots.add.noPermissions")}
                                ></Translatable>
                            {:else}
                                {#each requestedPermissions.messagePermissions as perm}
                                    <Checkbox
                                        id={`message_permission_${perm}`}
                                        label={i18nKey(`permissions.messagePermissions.${perm}`)}
                                        checked={grantedPermissions.messagePermissions.includes(
                                            perm,
                                        )}
                                        on:change={() =>
                                            togglePermission(
                                                grantedPermissions,
                                                "messagePermissions",
                                                perm,
                                            )}
                                        align={"start"}>
                                    </Checkbox>
                                {/each}
                            {/if}
                        {/snippet}
                        {#snippet threadTab()}
                            {#if requestedPermissions.threadPermissions.length === 0}
                                <Translatable resourceKey={i18nKey("bots.add.noPermissions")}
                                ></Translatable>
                            {:else}
                                {#each requestedPermissions.threadPermissions as perm}
                                    <Checkbox
                                        id={`thread_permission_${perm}`}
                                        label={i18nKey(`permissions.messagePermissions.${perm}`)}
                                        checked={grantedPermissions.threadPermissions.includes(
                                            perm,
                                        )}
                                        on:change={() =>
                                            togglePermission(
                                                grantedPermissions,
                                                "threadPermissions",
                                                perm,
                                            )}
                                        align={"start"}>
                                    </Checkbox>
                                {/each}
                            {/if}
                        {/snippet}
                    </BotPermissionsTabs>
                </div>
            </div>
        </div>
        <div class="footer" slot="footer">
            <ButtonGroup>
                <Button secondary small={!$mobileWidth} tiny={$mobileWidth} on:click={onClose}>
                    <Translatable resourceKey={i18nKey("cancel")} />
                </Button>
                <Button
                    on:click={addBot}
                    loading={adding}
                    small={!$mobileWidth}
                    tiny={$mobileWidth}>
                    <Translatable resourceKey={i18nKey("bots.add.addBot")} />
                </Button>
            </ButtonGroup>
        </div>
    </ModalContent>
</Overlay>

<style lang="scss">
    .body {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 12px;
    }
    .avatar {
        flex: 0 0 50px;
        position: relative;
        align-self: start;
    }

    .details {
        display: flex;
        gap: $sp2;
        flex: 1;
        flex-direction: column;
        @include font(book, normal, fs-100);

        .bot-name {
            @include ellipsis();
        }

        .bot-desc {
            @include font(light, normal, fs-100);
            color: var(--txt-light);
            margin-bottom: $sp3;

            &.collapsed {
                @include clamp(4);
            }
        }
    }

    .commands {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: $sp3;
        margin-bottom: $sp4;

        .command {
            @include font(light, normal, fs-80);
            background-color: var(--button-bg);
            border: 1px solid var(--button-bg);
            color: var(--button-txt);
            padding: $sp2 $sp3;
            border-radius: $sp2;
            cursor: pointer;

            &.not_permitted {
                background-color: unset;
                color: var(--txt);
                opacity: 0.8;
            }
        }
    }

    .info {
        @include font(book, normal, fs-70);
        color: var(--txt-light);
        margin-bottom: $sp4;
    }
</style>
