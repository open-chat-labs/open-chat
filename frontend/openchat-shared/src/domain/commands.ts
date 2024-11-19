/**
 * Validating whether the bot's command schema is valid is not the same as validating that a command built from the schema is valid.
 * e.g. the command schema will not have
 */
// This can be expanded as necessary to include things like ChatParam (e.g. for a /goto bot)
export type SlashCommandParamType = UserParam | BooleanParam | StringParam | NumberParam;

export type CommandParam = {
    name: string;
    description?: string;
    placeholder?: string;
    required: boolean;
    errorMessage?: string;
};

export type UserParam = {
    kind: "user";
};

export type BooleanParam = {
    kind: "boolean";
};

export type StringParam = CommandParam & {
    kind: "string";
    minLength: number;
    maxLength: number;
    choices?: SlashCommandOptionChoice<string>[];
};

export type NumberParam = {
    kind: "number";
    minValue: number;
    maxValue: number;
    choices?: SlashCommandOptionChoice<number>[];
};

export type SlashCommandOptionChoice<T> = {
    kind: "option";
    name: string;
    value: T;
};

export type SlashCommandParam = CommandParam & SlashCommandParamType;

export type SlashCommandSchema = {
    name: string;
    description?: string;
    params?: SlashCommandParam[];
};

export type ExternalBot = {
    name: string;
    icon: string;
    id: string;
    endpoint: string;
    description?: string;
    commands: SlashCommandSchema[];
};

export type FlattenedCommand = SlashCommandSchema & {
    botName: string;
    botIcon: string;
    botDescription?: string;
};
