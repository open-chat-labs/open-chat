import { Principal } from "@dfinity/principal";
import * as chrono from "chrono-node";
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
export type CommandParamType =
    | UserParam
    | BooleanParam
    | StringParam
    | IntegerParam
    | DecimalParam
    | DateTimeParam;

export type CommandParamCommon = {
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
    choices: CommandOptionChoice<string>[];
    multi_line: boolean;
};

export type IntegerParam = {
    kind: "integer";
    minValue: bigint;
    maxValue: bigint;
    choices: CommandOptionChoice<bigint>[];
};

export type DecimalParam = {
    kind: "decimal";
    minValue: number;
    maxValue: number;
    choices: CommandOptionChoice<number>[];
};

export type DateTimeParam = {
    kind: "dateTime";
    future_only: boolean;
};

export type CommandOptionChoice<T> = {
    name: string;
    value: T;
};

export type CommandParam = CommandParamCommon & CommandParamType;

function defaultCommonParam(param?: CommandParam): CommandParamCommon {
    return {
        name: param?.name ?? "",
        description: param?.description ?? "",
        placeholder: param?.placeholder ?? "",
        required: param?.required ?? true,
    };
}

export function defaultBooleanParam(param?: CommandParam): CommandParam {
    return {
        kind: "boolean",
        ...defaultCommonParam(param),
    };
}

export function defaultStringParam(param?: CommandParam): CommandParam {
    return {
        kind: "string",
        ...defaultCommonParam(param),
        minLength: 0,
        maxLength: 1000,
        choices: [],
        multi_line: false,
    };
}

export function defaultIntegerParam(param?: CommandParam): CommandParam {
    return {
        kind: "integer",
        ...defaultCommonParam(param),
        minValue: BigInt(0),
        maxValue: BigInt(1000),
        choices: [],
    };
}

export function defaultDecimalParam(param?: CommandParam): CommandParam {
    return {
        kind: "decimal",
        ...defaultCommonParam(param),
        minValue: 0,
        maxValue: 1000,
        choices: [],
    };
}

export function defaultUserParam(param?: CommandParam): CommandParam {
    return {
        kind: "user",
        ...defaultCommonParam(param),
    };
}

export function defaultDateTimeParam(param?: CommandParam): CommandParam {
    return {
        kind: "dateTime",
        ...defaultCommonParam(param),
        future_only: false,
    };
}

export function emptyBotCommand(): CommandDefinition {
    return {
        name: "",
        description: "",
        params: [],
        defaultRole: "member",
        permissions: emptyExternalBotPermissions(),
        directMessages: false,
    };
}

export type CommandDefinition = {
    name: string;
    description?: string;
    placeholder?: string;
    params: CommandParam[];
    permissions: ExternalBotPermissions;
    devmode?: boolean;
    defaultRole: MemberRole;
    directBotDisabled?: boolean;
    directMessages: boolean;
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

export type CommandInstance = {
    name: string;
    arguments: CommandArg[];
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
    commands: CommandDefinition[];
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
    command: CommandInstance;
};

export type InternalBotCommandInstance = {
    kind: "internal_bot";
    command: CommandInstance;
};

// Not sure about this just yet, but I feel like it's probably a thing

export type FlattenedExternalCommand = CommandDefinition & {
    kind: "external_bot";
    botName: string;
    avatarUrl?: string;
    botId: string;
    botEndpoint: string;
    botDescription?: string;
};

export type FlattenedInternalCommand = CommandDefinition & {
    kind: "internal_bot";
    botName: string;
    botDescription?: string;
};

export type FlattenedCommand = FlattenedExternalCommand | FlattenedInternalCommand;

export type CommandArgCommon = {
    name: string;
};

export type UserArg = {
    kind: "user";
    userId?: string;
};

export type BooleanArg = {
    kind: "boolean";
    value?: boolean;
};

export type StringArg = {
    kind: "string";
    value?: string;
};

export type IntegerArg = {
    kind: "integer";
    value: bigint | null;
};

export type DecimalArg = {
    kind: "decimal";
    value: number | null; // this is to do with how number input binding works
};

export type DateTimeArg = {
    kind: "dateTime";
    value?: bigint | null;
};

export type CommandArgType =
    | UserArg
    | BooleanArg
    | StringArg
    | IntegerArg
    | DecimalArg
    | DateTimeArg;

export type CommandArg = CommandArgCommon & CommandArgType;

function singleStringParam(params: CommandParam[]): boolean {
    return params.length === 1 && params[0].kind === "string";
}

export function createArgsFromSchema(params: CommandParam[], maybeArgs: string[]): CommandArg[] {
    if (singleStringParam(params)) {
        return [{ kind: "string", name: params[0].name, value: maybeArgs.join(" ") }];
    }
    return params.map((p, i) => {
        switch (p.kind) {
            case "user":
                return { kind: "user", name: p.name };
            case "boolean": {
                const boolVal = (maybeArgs[i] ?? "false").toLocaleLowerCase() === "true";
                return { kind: "boolean", name: p.name, value: boolVal };
            }
            case "integer": {
                let value: bigint | null = parseBigInt(maybeArgs[i]) ?? null;
                if (p.choices.length > 0) {
                    value = p.choices.find((c) => c.value === value)?.value ?? null;
                }
                return { kind: p.kind, name: p.name, value };
            }
            case "decimal": {
                const numParam = Number(maybeArgs[i]);
                let value = isNaN(numParam) ? null : numParam;
                if (p.choices.length > 0) {
                    value = p.choices.find((c) => c.value === value)?.value ?? null;
                }
                return { kind: p.kind, name: p.name, value };
            }
            case "string": {
                let strParam = maybeArgs[i] ?? "";
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
                const arg = maybeArgs[i];
                return {
                    name: p.name,
                    kind: "dateTime",
                    value: parseBigInt(arg) ?? parseDateTime(arg),
                };
            }
        }
    });
}

function parseDateTime(value: string): bigint | null {
    const now = new Date();

    const date = chrono.parseDate(
        value,
        { instant: now, timezone: now.getTimezoneOffset() },
        { forwardDate: true },
    );

    if (date == null) {
        return null;
    }

    return BigInt(date.getTime());
}

export function argIsValid(schema: CommandParam, arg: CommandArg): boolean {
    if (schema.kind === "user" && arg.kind === "user") {
        return !schema.required || arg.userId !== undefined;
    } else if (schema.kind === "boolean" && arg.kind === "boolean") {
        return !schema.required || arg.value !== undefined;
    } else if (schema.kind === "string" && arg.kind === "string") {
        return (
            !schema.required ||
            (arg.value !== undefined &&
                arg.value.length > schema.minLength &&
                arg.value.length < schema.maxLength)
        );
    } else if (schema.kind === "integer" && arg.kind === "integer") {
        return (
            (!schema.required && arg.value === null) ||
            (arg.value !== null && arg.value >= schema.minValue && arg.value <= schema.maxValue)
        );
    } else if (schema.kind === "decimal" && arg.kind === "decimal") {
        return (
            (!schema.required && arg.value === null) ||
            (arg.value !== null && arg.value >= schema.minValue && arg.value <= schema.maxValue)
        );
    } else if (schema.kind === "dateTime" && arg.kind === "dateTime") {
        return !schema.required || (arg.value !== undefined && arg.value !== null);
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
    command: CommandDefinition,
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

function containsDuplicateCommands(commands: CommandDefinition[]): boolean {
    const set = new Set(commands.map((c) => c.name));
    return set.size < commands.length;
}

function containsDuplicateParams(params: CommandParam[]): boolean {
    const set = new Set(params.map((p) => p.name));
    return set.size < params.length;
}

function validateParameter(
    param: CommandParam,
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

export function directMessageCommandInstance(
    bot: ExternalBot,
    text: string,
): BotCommandInstance | undefined {
    const command = bot.definition.commands.find((c) => {
        return c.directMessages && c.params[0]?.kind === "string";
    });
    if (command) {
        return {
            kind: "external_bot",
            id: bot.id,
            endpoint: bot.endpoint,
            command: {
                name: command.name,
                arguments: createArgsFromSchema(command.params, [text]),
                placeholder: command.placeholder,
            },
        };
    }
}
