import { Principal } from "@dfinity/principal";
import type { MessageContent, MessageContext } from "./chat";
import type { ChatPermissions, CommunityPermissions, MessagePermission } from "./permission";
import type { InterpolationValues, ResourceKey } from "../utils";
import { ValidationErrors } from "../utils/validation";

export const MIN_NAME_LENGTH = 3;

export type BotGroupDetails = {
    id: string;
    permissions: SlashCommandPermissions;
};

export type BotsResponse = {
    timestamp: bigint;
    bots: ExternalBot[];
};

// This can be expanded as necessary to include things like ChatParam (e.g. for a /goto bot)
export type SlashCommandParamType = UserParam | BooleanParam | StringParam | NumberParam;

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
};

export type NumberParam = {
    kind: "number";
    minValue: number;
    maxValue: number;
    choices: SlashCommandOptionChoice<number>[];
};

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
    };
}

export function defaultNumberParam(param?: SlashCommandParam): SlashCommandParam {
    return {
        kind: "number",
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

export function emptySlashCommand(): SlashCommandSchema {
    return {
        name: "",
        description: "",
        params: [],
        permissions: emptySlashCommandPermissions(),
    };
}

export type SlashCommandSchema = {
    name: string;
    description?: string;
    params: SlashCommandParam[];
    permissions: SlashCommandPermissions;
    devmode?: boolean;
};

export function emptySlashCommandPermissions(): SlashCommandPermissions {
    return {
        chatPermissions: [],
        communityPermissions: [],
        messagePermissions: [],
    };
}

export type SlashCommandPermissionsSet = {
    chatPermissions: Set<keyof ChatPermissions>;
    communityPermissions: Set<keyof CommunityPermissions>;
    messagePermissions: Set<MessagePermission>;
};

export function setifyCommandPermissions(
    perm: SlashCommandPermissions,
): SlashCommandPermissionsSet {
    return {
        chatPermissions: new Set(perm.chatPermissions),
        communityPermissions: new Set(perm.communityPermissions),
        messagePermissions: new Set(perm.messagePermissions),
    };
}

function hasEveryPermissionOfType<P extends keyof SlashCommandPermissions>(
    required: SlashCommandPermissions,
    granted: SlashCommandPermissionsSet,
    type: P,
): boolean {
    const r = required[type] as SlashCommandPermissions[P][number][];
    const g = granted[type] as Set<SlashCommandPermissions[P][number]>;
    return r.every((p) => g.has(p));
}

export function hasEveryRequiredPermission(
    required: SlashCommandPermissions,
    granted: SlashCommandPermissions,
): boolean {
    const grantedSet = setifyCommandPermissions(granted);
    return (
        hasEveryPermissionOfType(required, grantedSet, "chatPermissions") &&
        hasEveryPermissionOfType(required, grantedSet, "communityPermissions") &&
        hasEveryPermissionOfType(required, grantedSet, "messagePermissions")
    );
}

export type SlashCommandPermissions = {
    chatPermissions: (keyof ChatPermissions)[];
    communityPermissions: (keyof CommunityPermissions)[];
    messagePermissions: MessagePermission[];
};

export type SlashCommandInstance = {
    name: string;
    messageContext: MessageContext;
    params: SlashCommandParamInstance[];
};

export type Bot = ExternalBot | InternalBot;

export function emptyBotInstance(ownerId: string): ExternalBot {
    return {
        kind: "external_bot",
        id: "",
        principal: "",
        ownerId,
        name: "",
        endpoint: "",
        definition: {
            kind: "bot_definition",
            description: "",
            commands: [],
        },
    };
}

type BotCommon = {
    name: string;
    definition: BotDefinition;
};

export type ExternalBot = BotCommon & {
    kind: "external_bot";
    avatarUrl?: string;
    principal: string;
    id: string;
    ownerId: string;
    endpoint: string;
};

export type InternalBot = BotCommon & {
    kind: "internal_bot";
};

export type BotDefinition = {
    kind: "bot_definition";
    description: string;
    commands: SlashCommandSchema[];
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

export type FlattenedCommand = SlashCommandSchema &
    (
        | {
              kind: "external_bot";
              botName: string;
              avatarUrl?: string;
              botId: string;
              botEndpoint: string;
              botDescription?: string;
          }
        | {
              kind: "internal_bot";
              botName: string;
              botDescription?: string;
          }
    );

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

export type NumberParamInstance = {
    kind: "number";
    value: number | null; // this is to do with how number input binding works
};

export type SlashCommandParamTypeInstance =
    | UserParamInstance
    | BooleanParamInstance
    | StringParamInstance
    | NumberParamInstance;

export type SlashCommandParamInstance = CommandParamInstance & SlashCommandParamTypeInstance;

export function createParamInstancesFromSchema(
    params: SlashCommandParam[],
    maybeParams: string[],
): SlashCommandParamInstance[] {
    return params.map((p, i) => {
        switch (p.kind) {
            case "user":
                return { kind: "user", name: p.name };
            case "boolean":
                return { kind: "boolean", name: p.name, value: false };
            case "number": {
                const numParam = Number(maybeParams[i]);
                let value = isNaN(numParam) ? null : numParam;
                if (p.choices.length > 0) {
                    value = p.choices.find((c) => c.value === value)?.value ?? null;
                }
                return { kind: "number", name: p.name, value };
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
    } else if (schema.kind === "number" && instance.kind === "number") {
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
export function validBotComponentName(name: string): ResourceKey[] {
    const errors = [];
    if (name.length < MIN_NAME_LENGTH) {
        errors.push(i18nKey("bots.builder.errors.minLength", { n: MIN_NAME_LENGTH }));
    }
    const regex = /^[a-zA-Z0-9_]+$/;
    if (!regex.test(name)) {
        errors.push(i18nKey("bots.builder.errors.alphaOnly"));
    }
    return errors;
}

function validatePrincipal(p: string): boolean {
    try {
        Principal.fromText(p);
        return true;
    } catch (_) {
        return false;
    }
}

export function validEndpoint(endpoint: string): boolean {
    return validOrigin(endpoint) || validCanister(endpoint);
}

export function validateBot(bot: ExternalBot, mode: "register" | "update"): ValidationErrors {
    const errors = new ValidationErrors();
    errors.addErrors(`bot_name`, validBotComponentName(bot.name));

    if (bot.ownerId === "") {
        errors.addErrors("bot_owner", i18nKey("bots.builder.errors.owner"));
    }

    if (!validEndpoint(bot.endpoint)) {
        errors.addErrors("bot_endpoint", i18nKey("bots.builder.errors.endpoint"));
    }

    if (mode === "register" && !validatePrincipal(bot.principal)) {
        errors.addErrors("bot_principal", i18nKey("bots.builder.errors.principal"));
    }

    if (bot.definition.commands.length === 0) {
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
    const nameErrors = validBotComponentName(command.name);
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
    const nameErrors = validBotComponentName(param.name);
    if (nameErrors.length > 0) {
        errors.addErrors(`${errorPath}_name`, nameErrors);
        valid = false;
    }
    if (param.kind === "string") {
        param.choices.forEach((c, i) => {
            if (c.name.length < MIN_NAME_LENGTH) {
                errors.addErrors(
                    `${errorPath}_choices_${i}_name`,
                    i18nKey("bots.builder.errors.minLength", { n: 3 }),
                );
                valid = false;
            }
            if (c.value.length < MIN_NAME_LENGTH) {
                errors.addErrors(
                    `${errorPath}_choices_${i}_value`,
                    i18nKey("bots.builder.errors.minLength", { n: 3 }),
                );
                valid = false;
            }
        });
    }
    if (param.kind === "number") {
        param.choices.forEach((c, i) => {
            if (c.name.length < MIN_NAME_LENGTH) {
                errors.addErrors(
                    `${errorPath}_choices_${i}_name`,
                    i18nKey("bots.builder.errors.minLength", { n: 3 }),
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

function validCanister(canister: string | undefined): boolean {
    if (!canister) return false;
    try {
        Principal.fromText(canister);
        return true;
    } catch (_) {
        return false;
    }
}

export type BotCommandResponse = BotCommandSuccess | BotCommandFailure;

export type BotCommandFailure = {
    kind: "failure";
    error: unknown;
};

export type BotCommandSuccess = {
    kind: "success";
    placeholder?: BotResponseMessage;
};

export type BotResponseMessage = {
    messageId: bigint;
    messageContent: MessageContent;
};
