import type { MessageContext } from "./chat";
import type { DataContent } from "./data";
import type { ChatPermissions, CommunityPermissions, MessagePermission } from "./permission";

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

export function emptyBotInstance(): ExternalBot {
    return {
        kind: "external_bot",
        name: "",
        description: "",
        id: "",
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
