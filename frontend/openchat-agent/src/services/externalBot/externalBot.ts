import { type BotCommandResponse, type BotDefinitionResponse } from "openchat-shared";
import { Value, AssertError } from "@sinclair/typebox/value";
import { Type, type Static } from "@sinclair/typebox";
import { MessageContent, SlashCommandSchema } from "../../typebox";
import { externalBotDefinition, messageContent } from "../common/chatMappersV2";
import { mapOptional } from "../../utils/mapping";

type ApiBotDefinition = Static<typeof ApiBotDefinition>;
const ApiBotDefinition = Type.Object({
    description: Type.String(),
    commands: Type.Array(SlashCommandSchema),
});

type ApiBotResponse = Static<typeof ApiBotResponse>;
const ApiBotResponse = Type.Union([
    Type.Object({
        Success: Type.Object({
            message: Type.Optional(
                Type.Object({
                    id: Type.String(),
                    content: MessageContent,
                }),
            ),
        }),
    }),
    Type.Object({
        BadRequest: Type.Union([
            Type.Literal("AccessTokenNotFound"),
            Type.Literal("AccessTokenInvalid"),
            Type.Literal("AccessTokenExpired"),
            Type.Literal("CommandNotFound"),
            Type.Literal("ArgsInvalid"),
        ]),
    }),
    Type.Object({
        InternalError: Type.Any(),
    }),
]);

export function getBotDefinition(endpoint: string): Promise<BotDefinitionResponse> {
    return fetch(`${endpoint}`)
        .then((res) => {
            if (res.ok) {
                return res.json();
            } else {
                const msg = `Failed to load external bot schema: ${res.status}, ${
                    res.statusText
                }, ${JSON.stringify(endpoint)}`;
                return {
                    kind: "bot_definition_failure",
                    error: msg,
                };
            }
        })
        .then(validateSchema);
}

function validateSchema(json: unknown): BotDefinitionResponse {
    try {
        const value = Value.Parse(ApiBotDefinition, json);
        return externalBotDefinition(value);
    } catch (err) {
        return {
            kind: "bot_definition_failure",
            error: formatError(err),
        };
    }
}

function formatError(err: unknown) {
    if (err instanceof AssertError) {
        return `${err.message}: ${err.error?.path}`;
    }
    return err;
}

function validateBotResponse(json: unknown): BotCommandResponse {
    try {
        console.log("Bot command response json", json);
        const value = Value.Parse(ApiBotResponse, json);
        return externalBotResponse(value);
    } catch (err) {
        return {
            kind: "failure",
            error: formatError(err),
        };
    }
}

function externalBotResponse(value: ApiBotResponse): BotCommandResponse {
    if ("Success" in value) {
        return {
            kind: "success",
            placeholder: mapOptional(value.Success.message, ({ id, content }) => {
                return {
                    messageId: BigInt(id),
                    messageContent: messageContent(content, ""),
                };
            }),
        };
    }
    return { kind: "failure", error: value };
}

export function callBotCommandEndpoint(
    endpoint: string,
    token: string,
): Promise<BotCommandResponse> {
    const headers = new Headers();
    headers.append("Content-type", "text/plain");
    return fetch(`${endpoint}/execute_command`, {
        method: "POST",
        headers: headers,
        body: token,
    })
        .then((res) => {
            if (res.ok) {
                return res.json();
            } else {
                return "InternalError";
            }
        })
        .then(validateBotResponse)
        .catch((err) => {
            console.log("Bot command failed: ", err);
            return { kind: "failure", error: err };
        });
}
