<script lang="ts">
    import {
        OpenChat,
        type BotMatch,
        type CommunityIdentifier,
        type BotSummaryMode,
        type ExternalBotPermissions,
        type ExternalBot,
        type BotInstallationLocation,
        type ChatIdentifier,
    } from "openchat-client";
    import { getContext } from "svelte";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Translatable from "../Translatable.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Button from "../Button.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import Legend from "../Legend.svelte";
    import Checkbox from "../Checkbox.svelte";
    import { togglePermission } from "../../utils/bots";
    import { toastStore } from "../../stores/toast";
    import BotAvatar from "./BotAvatar.svelte";
    import ShowApiKey from "./ShowApiKey.svelte";
    import AreYouSure from "../AreYouSure.svelte";
    import Tabs from "../Tabs.svelte";
    import BotCommands from "./BotCommands.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        mode: BotSummaryMode;
        bot: BotMatch | ExternalBot;
        onClose: (removeDirectChat: boolean) => void;
    }

    let { bot, onClose, mode }: Props = $props();
    let busy = $state(false);
    let collapsed = $state(true);
    let title = $derived.by(() => {
        switch (mode.kind) {
            case "installing_command_bot":
                return i18nKey("bots.add.title");
            case "installing_direct_command_bot":
                return i18nKey("bots.add.titleDirect");
            case "editing_command_bot":
                return i18nKey("bots.edit.title");
            case "viewing_command_bot":
                return i18nKey("bots.view.title");
            case "adding_api_key":
                return i18nKey("bots.manage.generateApiKey");
            case "editing_api_key":
                return i18nKey("bots.manage.reviewApiKey");
        }
    });
    let cta = $derived.by(() => {
        switch (mode.kind) {
            case "installing_command_bot":
                return i18nKey("bots.add.addBot");
            case "installing_direct_command_bot":
                return i18nKey("bots.add.continue");
            case "editing_command_bot":
                return i18nKey("bots.edit.updateBot");
            case "viewing_command_bot":
                return i18nKey("bots.view.close");
            case "adding_api_key":
                return i18nKey("bots.manage.generate");
            case "editing_api_key":
                return i18nKey("bots.manage.regenerate");
        }
    });
    let showCommands = $derived(mode.kind !== "adding_api_key" && mode.kind !== "editing_api_key");
    let choosePermissions = $derived(mode.kind !== "viewing_command_bot");
    let grantedPermissions = $state(getInitialGrantedPermissions(mode));
    let apiKey = $state<string | undefined>(undefined);
    let confirmingRegeneration = $state(false);

    function getInitialGrantedPermissions(mode: BotSummaryMode): ExternalBotPermissions {
        switch (mode.kind) {
            case "editing_command_bot":
            case "editing_api_key":
            case "viewing_command_bot":
                return mode.granted;
            default:
                return mode.requested;
        }
    }

    function installBot(id: BotInstallationLocation) {
        busy = true;
        client
            .installBot($state.snapshot(id), bot.id, $state.snapshot(grantedPermissions))
            .then((success) => {
                if (!success) {
                    toastStore.showFailureToast(i18nKey("bots.add.failure"));
                } else {
                    onClose(false);
                }
            })
            .finally(() => (busy = false));
    }

    function updateBot(id: BotInstallationLocation) {
        busy = true;
        client
            .updateInstalledBot($state.snapshot(id), bot.id, $state.snapshot(grantedPermissions))
            .then((success) => {
                if (!success) {
                    toastStore.showFailureToast(i18nKey("bots.edit.failure"));
                } else {
                    onClose(false);
                }
            })
            .finally(() => (busy = false));
    }

    function generateApiKey(
        id: CommunityIdentifier | ChatIdentifier,
    ): (confirmed: boolean) => Promise<void> {
        return (confirmed: boolean) => {
            if (!confirmingRegeneration && !confirmed) {
                confirmingRegeneration = true;
                return Promise.resolve();
            }

            if (confirmed) {
                if (bot.definition.autonomousConfig !== undefined) {
                    busy = true;
                    client
                        .generateBotApiKey(
                            $state.snapshot(id),
                            bot.id,
                            $state.snapshot(grantedPermissions),
                        )
                        .then((resp) => {
                            if (resp.kind === "success") {
                                apiKey = resp.apiKey;
                            } else {
                                toastStore.showFailureToast(i18nKey("bots.manage.generateFailed"));
                            }
                        })
                        .finally(() => (busy = false));
                }
            }
            confirmingRegeneration = false;
            return Promise.resolve();
        };
    }

    function mainButton() {
        switch (mode.kind) {
            case "installing_command_bot":
                installBot(mode.id);
                break;
            case "installing_direct_command_bot":
                installBot(mode.id);
                break;
            case "editing_command_bot":
                updateBot(mode.id);
                break;
            case "viewing_command_bot":
                onClose(false);
                break;
            case "adding_api_key":
                generateApiKey(mode.id)(true);
                break;
            case "editing_api_key":
                generateApiKey(mode.id)(false);
                break;
        }
    }
</script>

{#if confirmingRegeneration && (mode.kind === "adding_api_key" || mode.kind === "editing_api_key")}
    <AreYouSure
        message={i18nKey("bots.manage.regenerateWarning")}
        action={generateApiKey(mode.id)} />
{/if}

{#if apiKey !== undefined}
    <ShowApiKey {apiKey} onClose={() => onClose(false)}></ShowApiKey>
{/if}

{#snippet chatTab()}
    {#if mode.requested.chatPermissions.length === 0}
        <Translatable resourceKey={i18nKey("bots.add.noPermissions")}></Translatable>
    {:else}
        {#each mode.requested.chatPermissions as perm}
            <Checkbox
                id={`chat_permission_${perm}`}
                label={i18nKey(`permissions.${perm}`)}
                checked={grantedPermissions.chatPermissions.includes(perm)}
                on:change={() => togglePermission(grantedPermissions, "chatPermissions", perm)}
                align={"start"}>
            </Checkbox>
        {/each}
    {/if}
{/snippet}
{#snippet communityTab()}
    {#if mode.requested.communityPermissions.length === 0}
        <Translatable resourceKey={i18nKey("bots.add.noPermissions")}></Translatable>
    {:else}
        {#each mode.requested.communityPermissions as perm}
            <Checkbox
                id={`community_permission_${perm}`}
                label={i18nKey(`permissions.${perm}`)}
                checked={grantedPermissions.communityPermissions.includes(perm)}
                on:change={() => togglePermission(grantedPermissions, "communityPermissions", perm)}
                align={"start"}>
            </Checkbox>
        {/each}
    {/if}
{/snippet}
{#snippet messageTab()}
    {#if mode.requested.messagePermissions.length === 0}
        <Translatable resourceKey={i18nKey("bots.add.noPermissions")}></Translatable>
    {:else}
        {#each mode.requested.messagePermissions as perm}
            <Checkbox
                id={`message_permission_${perm}`}
                label={i18nKey(`permissions.messagePermissions.${perm}`)}
                checked={grantedPermissions.messagePermissions.includes(perm)}
                on:change={() => togglePermission(grantedPermissions, "messagePermissions", perm)}
                align={"start"}>
            </Checkbox>
        {/each}
    {/if}
{/snippet}

<Overlay dismissible>
    <ModalContent closeIcon on:close={() => onClose(true)}>
        <div class="header" slot="header">
            <Translatable resourceKey={title}></Translatable>
        </div>
        <div class="body" slot="body">
            <span class="avatar">
                <BotAvatar {bot} />
            </span>
            <div class="details">
                <h4 class="bot-name">
                    {bot.name}
                </h4>
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <p
                    title={bot.definition.description}
                    class="bot-desc"
                    class:collapsed
                    onclick={() => (collapsed = !collapsed)}>
                    {bot.definition.description}
                </p>
                {#if showCommands}
                    <BotCommands {grantedPermissions} commands={bot.definition.commands} />
                {/if}
                {#if choosePermissions}
                    <div class="permissions">
                        <Legend label={i18nKey("bots.add.choosePermissions")}></Legend>
                        <p class="info">
                            <Translatable resourceKey={i18nKey("bots.add.permissionsInfo")}
                            ></Translatable>
                        </p>
                        <Tabs
                            initialIndex={2}
                            tabs={[
                                {
                                    title: i18nKey("bots.builder.permScopeCommunity"),
                                    snippet: communityTab,
                                },
                                {
                                    title: i18nKey("bots.builder.permScopeChat"),
                                    snippet: chatTab,
                                },
                                {
                                    title: i18nKey("bots.builder.permScopeMessage"),
                                    snippet: messageTab,
                                },
                            ]}></Tabs>
                    </div>
                {/if}
            </div>
        </div>
        <div class="footer" slot="footer">
            <ButtonGroup>
                <Button
                    secondary
                    small={!$mobileWidth}
                    tiny={$mobileWidth}
                    on:click={() => onClose(true)}>
                    <Translatable resourceKey={i18nKey("cancel")} />
                </Button>
                <Button
                    on:click={mainButton}
                    loading={busy}
                    disabled={busy}
                    small={!$mobileWidth}
                    tiny={$mobileWidth}>
                    <Translatable resourceKey={cta} />
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

    .info {
        @include font(book, normal, fs-70);
        color: var(--txt-light);
        margin-bottom: $sp4;
    }
</style>
