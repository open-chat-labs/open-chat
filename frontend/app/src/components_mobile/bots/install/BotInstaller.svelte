<script lang="ts">
    import SlidingPageContent from "@src/components_mobile/home/SlidingPageContent.svelte";
    import { BodySmall, Button, Container } from "component-lib";
    import {
        type ChatSummary,
        type CommunitySummary,
        definitionToPermissions,
        type ExternalBotLike,
        type GrantedBotPermissions,
        installationLocationFrom,
        OpenChat,
        publish,
        type ResourceKey,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { toastStore } from "../../../stores/toast";
    import Translatable from "../../Translatable.svelte";
    import BotCommands from "../BotCommands.svelte";
    import BotProperties from "./BotProperties.svelte";
    import ChoosePermissions from "./ChoosePermissions.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        collection: CommunitySummary | ChatSummary;
        bot: ExternalBotLike;
    }

    let { bot, collection }: Props = $props();
    let requestedPermissions = $derived(definitionToPermissions(bot.definition));
    let grantedPermissions = $state(filterByLocation(definitionToPermissions(bot.definition)));
    let location = $derived(installationLocationFrom(collection));
    let level = $derived(collection.kind === "direct_chat" ? "group" : collection.level); // TODO suspect

    let busy = $state(false);

    function filterByLocation(perm: GrantedBotPermissions): GrantedBotPermissions {
        if (collection.kind === "group_chat") {
            perm.command.communityPermissions = [];
            if (perm.autonomous !== undefined) {
                perm.autonomous.communityPermissions = [];
            }
        }
        return perm;
    }

    function install() {
        client
            .installBot(location, bot.id, {
                command: grantedPermissions.command,
                autonomous: grantedPermissions.autonomous,
            })
            .then((success) => {
                if (!success) {
                    toastStore.showFailureToast(i18nKey("bots.add.failure"));
                } else {
                    publish("closeModalPage");
                }
            })
            .finally(() => (busy = false));
    }
</script>

<SlidingPageContent title={i18nKey("bots.add.title", undefined, level, true)}>
    <Container direction={"vertical"} padding={["xl", "lg"]}>
        <BotProperties installing={busy} {grantedPermissions} {bot}>
            <ChoosePermissions
                {level}
                title={i18nKey("bots.add.chooseCommandPermissions")}
                subtitle={i18nKey("bots.add.commandPermissionsInfo")}
                bind:granted={grantedPermissions.command}
                requested={requestedPermissions.command} />
            <ChoosePermissions
                {level}
                title={i18nKey("bots.add.chooseAutonomousPermissions")}
                subtitle={i18nKey("bots.add.autonomousPermissionsInfo")}
                bind:granted={grantedPermissions.autonomous!}
                requested={requestedPermissions.autonomous!} />
        </BotProperties>

        <Container padding={["zero", "md"]} direction={"vertical"} gap={"sm"}>
            <BodySmall fontWeight={"bold"} colour={"textSecondary"}>
                <Translatable resourceKey={i18nKey("Commands")} />
            </BodySmall>
            <BotCommands {grantedPermissions} commands={bot.definition.commands} />
        </Container>
    </Container>
    <div class="footer">
        {@render button(i18nKey("cancel"), () => publish("closeModalPage"), true)}
        {@render button(i18nKey("bots.add.install"), install)}
    </div>
</SlidingPageContent>

{#snippet button(
    txt: ResourceKey,
    click: () => void,
    secondary = false,
    disabled = busy,
    loading = busy,
)}
    <Button {secondary} {disabled} {loading} onClick={click}>
        <Translatable resourceKey={txt} />
    </Button>
{/snippet}

<style lang="scss">
    .body {
        display: flex;
        justify-content: center;
        gap: 12px;
        flex-direction: column;
    }
</style>
