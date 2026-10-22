// The state and logic for installing a bot, or changing the permissions of one already installed, so
// that the components in both trees can be as purely presentational as possible. It returns
// outcomes; each tree shows them.

import {
    definitionToPermissions,
    permissionsToGrant,
    type BotInstallationLocation,
    type ExternalBotLike,
    type GrantedBotPermissions,
    type OpenChat,
    type ResourceKey,
} from "@client";
import { i18nKey } from "@src/i18n/i18n";

// The step of a form that asks for the command permissions and the autonomous ones in turn
export type BotInstallStep =
    | "choose_command_permissions"
    | "choose_autonomous_permissions"
    | "unknown";

export type SaveBotOutcome =
    | { kind: "installed" }
    | { kind: "updated" }
    | { kind: "failed"; message: ResourceKey };

export class BotInstall {
    #client: OpenChat;
    #bot: ExternalBotLike;
    #location: BotInstallationLocation;
    #installing: boolean;
    #busy = $state(false);
    #step = $state<BotInstallStep>("unknown");

    // The permissions the user is granting the bot
    grantedPermissions: GrantedBotPermissions;

    /**
     * `installed` is the permissions the bot already has, when it is installed and the user is
     * changing them; otherwise the bot is being installed.
     */
    constructor(
        client: OpenChat,
        bot: ExternalBotLike,
        location: BotInstallationLocation,
        installed?: GrantedBotPermissions,
    ) {
        this.#client = client;
        this.#bot = bot;
        this.#location = location;
        this.#installing = installed === undefined;
        this.grantedPermissions = $state(installed ?? permissionsToGrant(bot.definition, location));
        if (bot.definition.commands.length > 0) {
            this.#step = "choose_command_permissions";
        } else if (bot.definition.autonomousConfig !== undefined) {
            this.#step = "choose_autonomous_permissions";
        }
    }

    get requestedPermissions(): GrantedBotPermissions {
        return definitionToPermissions(this.#bot.definition);
    }

    get installing(): boolean {
        return this.#installing;
    }

    get busy(): boolean {
        return this.#busy;
    }

    get step(): BotInstallStep {
        return this.#step;
    }

    // Whether the autonomous permissions are still to be chosen after this step
    get hasNextStep(): boolean {
        return (
            this.#step === "choose_command_permissions" &&
            this.#bot.definition.autonomousConfig !== undefined
        );
    }

    next() {
        if (this.hasNextStep) this.#step = "choose_autonomous_permissions";
    }

    // Installs the bot with the permissions granted, or saves the change to them
    async save(): Promise<SaveBotOutcome> {
        const permissions = $state.snapshot(this.grantedPermissions);
        this.#busy = true;
        try {
            if (this.#installing) {
                const installed = await this.#client.installBot(
                    this.#location,
                    this.#bot.id,
                    permissions,
                );
                return installed
                    ? { kind: "installed" }
                    : { kind: "failed", message: i18nKey("bots.add.failure") };
            }
            const updated = await this.#client.updateInstalledBot(
                this.#location,
                this.#bot.id,
                permissions,
            );
            return updated
                ? { kind: "updated" }
                : { kind: "failed", message: i18nKey("bots.edit.failure") };
        } finally {
            this.#busy = false;
        }
    }
}
