import { Principal } from "@dfinity/principal";
import type {
    ChatIdentifier,
    DirectChatIdentifier,
    GroupChatIdentifier,
    MessageContent,
} from "./chat";
import type {
    BotActionScope,
    BotChatPermission,
    BotCommunityPermission,
    MemberRole,
    MessagePermission,
} from "./permission";
import { type InterpolationValues, parseBigInt, random64, type ResourceKey } from "../utils";
import { ValidationErrors } from "../utils/validation";
import type { CommunityIdentifier } from "./community";
import type { BotMatch } from "./search/search";

export const MIN_NAME_LENGTH = 3;
export const MIN_PARAM_NAME_LENGTH = 1;

export type InstalledBotDetails = {
    id: string;
    permissions: ExternalBotPermissions;
};

export type BotInstallationLocation =
    | CommunityIdentifier
    | GroupChatIdentifier
    | DirectChatIdentifier;

export type BotsResponse = {
    timestamp: bigint;
    bots: ExternalBot[];
};

// This can be expanded as necessary to include things like ChatParam (e.g. for a /goto bot)
export type SlashCommandParamType =
    | UserParam
    | BooleanParam
    | StringParam
    | IntegerParam
    | DecimalParam
    | DateTimeParam;

export type CommandParam = {
    name: string;
    description?: string;
    placeholder?: string;
    required: boolean;
};

export type UserParam = {
    kind: "user";
};

export type BooleanParam = {
    kind: "boolean";
};

export type StringParam = {
    kind: "string";
    minLength: number;
    maxLength: number;
    choices: SlashCommandOptionChoice<string>[];
    multi_line: boolean;
};

export type IntegerParam = {
    kind: "integer";
    minValue: bigint;
    maxValue: bigint;
    choices: SlashCommandOptionChoice<bigint>[];
};

export type DecimalParam = {
    kind: "decimal";
    minValue: number;
    maxValue: number;
    choices: SlashCommandOptionChoice<number>[];
};

export type DateTimeParam = {
    kind: "dateTime";
    future_only: boolean;
}

export type SlashCommandOptionChoice<T> = {
    name: string;
    value: T;
};

export type SlashCommandParam = CommandParam & SlashCommandParamType;

function defaultCommonParam(param?: SlashCommandParam): CommandParam {
    return {
        name: param?.name ?? "",
        description: param?.description ?? "",
        placeholder: param?.placeholder ?? "",
        required: param?.required ?? true,
    };
}

export function defaultBooleanParam(param?: SlashCommandParam): SlashCommandParam {
    return {
        kind: "boolean",
        ...defaultCommonParam(param),
    };
}

export function defaultStringParam(param?: SlashCommandParam): SlashCommandParam {
    return {
        kind: "string",
        ...defaultCommonParam(param),
        minLength: 0,
        maxLength: 1000,
        choices: [],
        multi_line: false,
    };
}

export function defaultIntegerParam(param?: SlashCommandParam): SlashCommandParam {
    return {
        kind: "integer",
        ...defaultCommonParam(param),
        minValue: BigInt(0),
        maxValue: BigInt(1000),
        choices: [],
    };
}

export function defaultDecimalParam(param?: SlashCommandParam): SlashCommandParam {
    return {
        kind: "decimal",
        ...defaultCommonParam(param),
        minValue: 0,
        maxValue: 1000,
        choices: [],
    };
}

export function defaultUserParam(param?: SlashCommandParam): SlashCommandParam {
    return {
        kind: "user",
        ...defaultCommonParam(param),
    };
}

export function defaultDateTimeParam(param?: SlashCommandParam): SlashCommandParam {
    return {
        kind: "dateTime",
        ...defaultCommonParam(param),
        future_only: false,
    }
}

export function emptySlashCommand(): SlashCommandSchema {
    return {
        name: "",
        description: "",
        params: [],
        defaultRole: "member",
        permissions: emptyExternalBotPermissions(),
    };
}

export type SlashCommandSchema = {
    name: string;
    description?: string;
    placeholder?: string;
    params: SlashCommandParam[];
    permissions: ExternalBotPermissions;
    devmode?: boolean;
    defaultRole: MemberRole;
    directBotDisabled?: boolean;
};

export function emptyExternalBotPermissions(): ExternalBotPermissions {
    return {
        chatPermissions: [],
        communityPermissions: [],
        messagePermissions: [],
    };
}

export function flattenCommandPermissions(definition: BotDefinition): ExternalBotPermissions {
    return definition.commands.reduce((p, c) => {
        return mergePermissions(p, c.permissions);
    }, emptyExternalBotPermissions());
}

function mergeLists<T>(l1: T[], l2: T[]): T[] {
    return [...new Set([...l1, ...l2])];
}

function mergePermissions(
    p1: ExternalBotPermissions,
    p2: ExternalBotPermissions,
): ExternalBotPermissions {
    return {
        chatPermissions: mergeLists(p1.chatPermissions, p2.chatPermissions),
        communityPermissions: mergeLists(p1.communityPermissions, p2.communityPermissions),
        messagePermissions: mergeLists(p1.messagePermissions, p2.messagePermissions),
    };
}

export type ExternalBotPermissionsSet = {
    chatPermissions: Set<BotChatPermission>;
    communityPermissions: Set<BotCommunityPermission>;
    messagePermissions: Set<MessagePermission>;
};

export function setifyCommandPermissions(perm: ExternalBotPermissions): ExternalBotPermissionsSet {
    return {
        chatPermissions: new Set(perm.chatPermissions),
        communityPermissions: new Set(perm.communityPermissions),
        messagePermissions: new Set(perm.messagePermissions),
    };
}

function hasEveryPermissionOfType<P extends keyof ExternalBotPermissions>(
    required: ExternalBotPermissions,
    granted: ExternalBotPermissionsSet,
    type: P,
): boolean {
    const r = required[type] as ExternalBotPermissions[P][number][];
    const g = granted[type] as Set<ExternalBotPermissions[P][number]>;
    return r.every((p) => g.has(p));
}

export function hasEveryRequiredPermission(
    required: ExternalBotPermissions,
    granted: ExternalBotPermissions,
): boolean {
    const grantedSet = setifyCommandPermissions(granted);
    return (
        hasEveryPermissionOfType(required, grantedSet, "chatPermissions") &&
        hasEveryPermissionOfType(required, grantedSet, "communityPermissions") &&
        hasEveryPermissionOfType(required, grantedSet, "messagePermissions")
    );
}

export type ExternalBotPermissions = {
    chatPermissions: BotChatPermission[];
    communityPermissions: BotCommunityPermission[];
    messagePermissions: MessagePermission[];
};

export type SlashCommandInstance = {
    name: string;
    params: SlashCommandParamInstance[];
    placeholder?: string;
};

export type Bot = ExternalBot | InternalBot;

export function emptyBotInstance(ownerId: string): ExternalBot {
    return {
        kind: "external_bot",
        id: "",
        ownerId,
        name: "",
        endpoint: "",
        definition: {
            kind: "bot_definition",
            description: "",
            commands: [],
        },
        registrationStatus: { kind: "private" },
    };
}

type BotCommon = {
    name: string;
    definition: BotDefinition;
};

export type ExternalBotLike = ExternalBot | BotMatch;

export type ExternalBot = BotCommon & {
    kind: "external_bot";
    avatarUrl?: string;
    id: string;
    ownerId: string;
    endpoint: string;
    registrationStatus: BotRegistrationStatus;
};

export type BotRegistrationStatus = BotPublic | BotPrivate;

export type BotPublic = { kind: "public" };

export type BotPrivate = { kind: "private"; location?: BotInstallationLocation };

export type InternalBot = BotCommon & {
    kind: "internal_bot";
};

export type BotDefinition = {
    kind: "bot_definition";
    description: string;
    commands: SlashCommandSchema[];
    autonomousConfig?: AutonomousBotConfig;
};

export type AutonomousBotConfig = {
    syncApiKey: boolean;
    permissions: ExternalBotPermissions;
};

export type BotDefinitionFailure = {
    kind: "bot_definition_failure";
    error: unknown;
};

export type BotDefinitionResponse = BotDefinition | BotDefinitionFailure;

export type BotCommandInstance = ExternalBotCommandInstance | InternalBotCommandInstance;

export type ExternalBotCommandInstance = {
    kind: "external_bot";
    id: string;
    endpoint: string;
    command: SlashCommandInstance;
};

export type InternalBotCommandInstance = {
    kind: "internal_bot";
    command: SlashCommandInstance;
};

// Not sure about this just yet, but I feel like it's probably a thing

export type FlattenedExternalCommand = SlashCommandSchema & {
    kind: "external_bot";
    botName: string;
    avatarUrl?: string;
    botId: string;
    botEndpoint: string;
    botDescription?: string;
};

export type FlattenedInternalCommand = SlashCommandSchema & {
    kind: "internal_bot";
    botName: string;
    botDescription?: string;
};

export type FlattenedCommand = FlattenedExternalCommand | FlattenedInternalCommand;

export type CommandParamInstance = {
    name: string;
};

export type UserParamInstance = {
    kind: "user";
    userId?: string;
};

export type BooleanParamInstance = {
    kind: "boolean";
    value?: boolean;
};

export type StringParamInstance = {
    kind: "string";
    value?: string;
};

export type IntegerParamInstance = {
    kind: "integer";
    value: bigint | null;
};

export type DecimalParamInstance = {
    kind: "decimal";
    value: number | null; // this is to do with how number input binding works
};

export type DateTimeParamInstance = {
    kind: "dateTime",
    value?: BigInt | null,
}

export type SlashCommandParamTypeInstance =
    | UserParamInstance
    | BooleanParamInstance
    | StringParamInstance
    | IntegerParamInstance
    | DecimalParamInstance
    | DateTimeParamInstance;

export type SlashCommandParamInstance = CommandParamInstance & SlashCommandParamTypeInstance;

export function createParamInstancesFromSchema(
    params: SlashCommandParam[],
    maybeParams: string[],
): SlashCommandParamInstance[] {
    return params.map((p, i) => {
        switch (p.kind) {
            case "user":
                return { kind: "user", name: p.name };
            case "boolean": {
                const boolVal = (maybeParams[i] ?? "false").toLocaleLowerCase() === "true";
                return { kind: "boolean", name: p.name, value: boolVal };
            }
            case "integer": {
                let value: bigint | null = parseBigInt(maybeParams[i]) ?? null;
                if (p.choices.length > 0) {
                    value = p.choices.find((c) => c.value === value)?.value ?? null;
                }
                return { kind: p.kind, name: p.name, value };
            }
            case "decimal": {
                const numParam = Number(maybeParams[i]);
                let value = isNaN(numParam) ? null : numParam;
                if (p.choices.length > 0) {
                    value = p.choices.find((c) => c.value === value)?.value ?? null;
                }
                return { kind: p.kind, name: p.name, value };
            }
            case "string": {
                let strParam = maybeParams[i] ?? "";
                if (p.choices.length > 0) {
                    strParam =
                        p.choices.find(
                            (c) =>
                                c.name.toLocaleLowerCase() === strParam.toLocaleLowerCase() ||
                                c.value.toLocaleLowerCase() === strParam.toLocaleLowerCase(),
                        )?.value ?? "";
                }
                return { kind: "string", name: p.name, value: strParam };
            }
            case "dateTime": {
                return {
                    name: p.name,
                    kind: "dateTime",
                    value: null, //? Do I need to set a value here?
                }
            }
        }
    });
}

export function paramInstanceIsValid(
    schema: SlashCommandParam,
    instance: SlashCommandParamInstance,
): boolean {
    if (schema.kind === "user" && instance.kind === "user") {
        return !schema.required || instance.userId !== undefined;
    } else if (schema.kind === "boolean" && instance.kind === "boolean") {
        return !schema.required || instance.value !== undefined;
    } else if (schema.kind === "string" && instance.kind === "string") {
        return (
            !schema.required ||
            (instance.value !== undefined &&
                instance.value.length > schema.minLength &&
                instance.value.length < schema.maxLength)
        );
    } else if (schema.kind === "integer" && instance.kind === "integer") {
        return (
            (!schema.required && instance.value === null) ||
            (instance.value !== null &&
                instance.value >= schema.minValue &&
                instance.value <= schema.maxValue)
        );
    } else if (schema.kind === "decimal" && instance.kind === "decimal") {
        return (
            (!schema.required && instance.value === null) ||
            (instance.value !== null &&
                instance.value >= schema.minValue &&
                instance.value <= schema.maxValue)
        );
    }

    return false;
}

export function i18nKey(key: string, params?: InterpolationValues): ResourceKey {
    return {
        kind: "resource_key",
        key,
        params,
        lowercase: false,
    };
}

// This is used for all names: bot, command, param
export function validBotComponentName(name: string, min: number): ResourceKey[] {
    const errors = [];
    if (name.length < min) {
        errors.push(i18nKey("bots.builder.errors.minLength", { n: min }));
    }
    const regex = /^[a-zA-Z0-9_]+$/;
    if (!regex.test(name)) {
        errors.push(i18nKey("bots.builder.errors.alphaOnly"));
    }
    return errors;
}

function validatePrincipal(p: string, mode: "register" | "update"): boolean {
    if (mode === "update" && p === "") return true;

    try {
        Principal.fromText(p);
        return true;
    } catch (_) {
        return false;
    }
}

export function validEndpoint(endpoint: string): boolean {
    return validOrigin(endpoint);
}

export function validateBot(
    principal: string,
    bot: ExternalBot,
    mode: "register" | "update",
): ValidationErrors {
    const errors = new ValidationErrors();
    errors.addErrors(`bot_name`, validBotComponentName(bot.name, MIN_NAME_LENGTH));

    if (bot.ownerId === "") {
        errors.addErrors("bot_owner", i18nKey("bots.builder.errors.owner"));
    }

    if (!validEndpoint(bot.endpoint)) {
        errors.addErrors("bot_endpoint", i18nKey("bots.builder.errors.endpoint"));
    }

    if (!validatePrincipal(principal, mode)) {
        errors.addErrors("bot_principal", i18nKey("bots.builder.errors.principal"));
    }

    if (bot.definition.commands.length === 0 && bot.definition.autonomousConfig === undefined) {
        errors.addErrors("no_commands", i18nKey("bots.builder.errors.noCommands"));
    }

    if (containsDuplicateCommands(bot.definition.commands)) {
        errors.addErrors("duplicate_commands", i18nKey("bots.builder.errors.duplicateCommands"));
    }

    bot.definition.commands.forEach((command, i) => {
        if (!validateCommand(command, `command_${i}`, errors)) {
            errors.addErrors(`command_${i}`, i18nKey("Command has errors"));
        }
    });
    return errors;
}

function validateCommand(
    command: SlashCommandSchema,
    errorPath: string,
    errors: ValidationErrors,
): boolean {
    let valid = true;
    const nameErrors = validBotComponentName(command.name, MIN_NAME_LENGTH);
    if (nameErrors.length > 0) {
        errors.addErrors(`${errorPath}_name`, nameErrors);
        valid = false;
    }
    if (containsDuplicateParams(command.params)) {
        errors.addErrors(
            `${errorPath}_duplicate_params`,
            i18nKey("bots.builder.errors.duplicateParams"),
        );
    }
    command.params.forEach((p, i) => {
        const paramPath = `${errorPath}_param_${i}`;
        if (!validateParameter(p, paramPath, errors)) {
            errors.addErrors(paramPath, i18nKey("Parameter has errors"));
            valid = false;
        }
    });
    return valid;
}

function containsDuplicateCommands(commands: SlashCommandSchema[]): boolean {
    const set = new Set(commands.map((c) => c.name));
    return set.size < commands.length;
}

function containsDuplicateParams(params: SlashCommandParam[]): boolean {
    const set = new Set(params.map((p) => p.name));
    return set.size < params.length;
}

function validateParameter(
    param: SlashCommandParam,
    errorPath: string,
    errors: ValidationErrors,
): boolean {
    let valid = true;
    const nameErrors = validBotComponentName(param.name, MIN_PARAM_NAME_LENGTH);
    if (nameErrors.length > 0) {
        errors.addErrors(`${errorPath}_name`, nameErrors);
        valid = false;
    }
    if (param.kind === "string") {
        param.choices.forEach((c, i) => {
            if (c.name.length < MIN_PARAM_NAME_LENGTH) {
                errors.addErrors(
                    `${errorPath}_choices_${i}_name`,
                    i18nKey("bots.builder.errors.minLength", { n: MIN_PARAM_NAME_LENGTH }),
                );
                valid = false;
            }
            if (c.value.length < MIN_PARAM_NAME_LENGTH) {
                errors.addErrors(
                    `${errorPath}_choices_${i}_value`,
                    i18nKey("bots.builder.errors.minLength", { n: MIN_PARAM_NAME_LENGTH }),
                );
                valid = false;
            }
        });
    }
    if (param.kind === "integer") {
        param.choices.forEach((c, i) => {
            if (c.name.length < MIN_PARAM_NAME_LENGTH) {
                errors.addErrors(
                    `${errorPath}_choices_${i}_name`,
                    i18nKey("bots.builder.errors.minLength", { n: MIN_PARAM_NAME_LENGTH }),
                );
                valid = false;
            }
        });
    }
    if (param.kind === "decimal") {
        param.choices.forEach((c, i) => {
            if (c.name.length < MIN_NAME_LENGTH) {
                errors.addErrors(
                    `${errorPath}_choices_${i}_name`,
                    i18nKey("bots.builder.errors.minLength", { n: MIN_PARAM_NAME_LENGTH }),
                );
                valid = false;
            }
        });
    }
    return valid;
}

function validOrigin(origin: string | undefined): boolean {
    if (!origin) return false;
    try {
        const o = new URL(origin);
        return o.origin === origin;
    } catch (_) {
        return false;
    }
}

export type BotCommandResponse =
    | BotCommandSuccess
    | BotCommandBadRequest
    | BotCommandTooManyRequests
    | BotCommandInternalError;

export type BotCommandBadRequest = {
    kind: "bad_request";
    reason: string;
};

export type BotCommandTooManyRequests = {
    kind: "too_many_requests";
};

export type BotCommandInternalError = {
    kind: "internal_error";
    error: unknown;
};

export type BotCommandSuccess = {
    kind: "success";
    message?: BotResponseMessage;
};

export type BotResponseMessage = {
    messageId: bigint;
    messageContent: MessageContent;
    finalised: boolean;
    blockLevelMarkdown: boolean;
    ephemeral: boolean;
};

export type BotClientConfigData = {
    ocPublicKey: string;
    openStorageIndexCanister: string;
    icHost: string;
};

export type BotSummaryMode = EditingCommandBot | ViewingCommandBot | AddingApiKey | EditingApiKey;

type BotSummaryModeCommon = {
    requested: ExternalBotPermissions;
};

export type EditingCommandBot = BotSummaryModeCommon & {
    kind: "editing_command_bot";
    id: CommunityIdentifier | GroupChatIdentifier | DirectChatIdentifier;
    granted: ExternalBotPermissions;
};

export type ViewingCommandBot = BotSummaryModeCommon & {
    kind: "viewing_command_bot";
    id: CommunityIdentifier | GroupChatIdentifier | DirectChatIdentifier;
    granted: ExternalBotPermissions;
};

export type AddingApiKey = BotSummaryModeCommon & {
    kind: "adding_api_key";
    id: CommunityIdentifier | ChatIdentifier;
};

// Editing will infact amount to generating a new key
export type EditingApiKey = BotSummaryModeCommon & {
    kind: "editing_api_key";
    id: CommunityIdentifier | ChatIdentifier;
    granted: ExternalBotPermissions;
    apiKey?: string;
};

export type EnhancedExternalBot = ExternalBot & { grantedPermissions: ExternalBotPermissions };

export function botActionScopeFromExecutionContext(
    ctx: CommunityIdentifier | ChatIdentifier,
): BotActionScope {
    switch (ctx.kind) {
        case "community":
            return {
                kind: "community_scope",
                communityId: ctx,
            };
        default:
            return {
                kind: "chat_scope",
                chatId: ctx,
                messageId: random64(),
                threadRootMessageIndex: undefined,
            };
    }
}

export function botActionScopeFromInstallLocation(
    location: BotInstallationLocation,
): BotActionScope {
    switch (location.kind) {
        case "community":
            return {
                kind: "community_scope",
                communityId: { kind: "community", communityId: location.communityId },
            };
        default:
            return {
                kind: "chat_scope",
                chatId: location,
                messageId: random64(),
                threadRootMessageIndex: undefined,
            };
    }
}
