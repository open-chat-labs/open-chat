import { Principal } from "@dfinity/principal";
import type { MessageContext } from "./chat";
import type { DataContent } from "./data";
import type { ChatPermissions, CommunityPermissions, MessagePermission } from "./permission";

export const MIN_NAME_LENGTH = 3;

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
        permissions: emptyPermissions(),
    };
}

export type SlashCommandSchema = {
    name: string;
    description?: string;
    params: SlashCommandParam[];
    permissions: SlashCommandPermissions;
    devmode?: boolean;
};

export function emptyPermissions(): SlashCommandPermissions {
    return {
        chatPermissions: [],
        communityPermissions: [],
        messagePermissions: [],
        threadPermissions: [],
    };
}

export type SlashCommandPermissions = {
    chatPermissions: (keyof ChatPermissions)[];
    communityPermissions: (keyof CommunityPermissions)[];
    messagePermissions: MessagePermission[];
    threadPermissions: MessagePermission[];
};

export type SlashCommandInstance = {
    name: string;
    messageContext: MessageContext;
    params: SlashCommandParamInstance[];
};

export type Bot = ExternalBot | InternalBot;

export type CandidateExternalBot = Omit<ExternalBot, "id">;

export function emptyBotInstance(bot: ExternalBot | undefined): CandidateExternalBot {
    return bot
        ? structuredClone(bot)
        : {
              kind: "external_bot",
              name: "",
              description: "",
              endpoint: "",
              commands: [],
          };
}

export type ExternalBot = {
    kind: "external_bot";
    name: string;
    icon?: DataContent;
    id: string;
    endpoint: string;
    description?: string;
    commands: SlashCommandSchema[];
};

export type InternalBot = {
    kind: "internal_bot";
    name: string;
    description?: string;
    commands: SlashCommandSchema[];
};

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
              botIcon?: DataContent;
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

// This is used for all names: bot, command, param
export function validBotComponentName(name: string) {
    const regex = new RegExp(`^[a-zA-Z0-9_]{${MIN_NAME_LENGTH},}$`);
    return regex.test(name);
}

type BotValidationError = string; // this might not be enough
export type BotValidationErrors = Map<string, BotValidationError>;

export function validateBot(bot: CandidateExternalBot): BotValidationErrors {
    const errors: BotValidationErrors = new Map();
    if (!validBotComponentName(bot.name)) {
        errors.set(`bot_name`, "Required field can only contain alphanumerics and underscores");
    }
    if (!(validateOrigin(bot.endpoint) || validateCanister(bot.endpoint))) {
        errors.set("bot_endpoint", "Endpoint must be a valid origin or canisterID");
    }

    if (containsDuplicateCommands(bot.commands)) {
        errors.set("duplicate_commands", "Bot contains commands with duplicate names");
    }

    bot.commands.forEach((command, i) => {
        if (!validateCommand(command, `command_${i}`, errors)) {
            errors.set(`command_${i}`, "Command has errors");
        }
    });
    console.log("Errors: ", errors);
    return errors;
}

function validateCommand(
    command: SlashCommandSchema,
    errorPath: string,
    errors: BotValidationErrors,
): boolean {
    let valid = true;
    if (!validBotComponentName(command.name)) {
        errors.set(
            `${errorPath}_name`,
            "Required field can only contain alphanumerics and underscores",
        );
        valid = false;
    }
    if (containsDuplicateParams(command.params)) {
        errors.set(`${errorPath}_duplicate_params`, "Command contains params with duplicate names");
    }
    command.params.forEach((p, i) => {
        const paramPath = `${errorPath}_param_${i}`;
        if (!validateParameter(p, paramPath, errors)) {
            errors.set(paramPath, "Parameter has errors");
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
    errors: BotValidationErrors,
): boolean {
    let valid = true;
    if (!validBotComponentName(param.name)) {
        errors.set(
            `${errorPath}_name`,
            "Required field can only contain alphanumerics and underscores",
        );
        valid = false;
    }
    if (param.kind === "string") {
        param.choices.forEach((c, i) => {
            if (c.name.length < MIN_NAME_LENGTH) {
                errors.set(`${errorPath}_choices_${i}_name`, "Choice name must be >= 3 characters");
                valid = false;
            }
            if (c.value.length < MIN_NAME_LENGTH) {
                errors.set(
                    `${errorPath}_choices_${i}_value`,
                    "Choice value must be >= 3 characters",
                );
                valid = false;
            }
        });
    }
    if (param.kind === "number") {
        param.choices.forEach((c, i) => {
            if (c.name.length < MIN_NAME_LENGTH) {
                errors.set(`${errorPath}_choices_${i}_name`, "Choice name must be >= 3 characters");
                valid = false;
            }
        });
    }
    return valid;
}

function validateOrigin(origin: string | undefined): boolean {
    if (!origin) return false;
    try {
        const o = new URL(origin);
        return o.origin === origin;
    } catch (_) {
        return false;
    }
}

function validateCanister(canister: string | undefined): boolean {
    if (!canister) return false;
    try {
        Principal.fromText(canister);
        return true;
    } catch (_) {
        return false;
    }
}
