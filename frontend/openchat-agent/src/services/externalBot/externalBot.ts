import { type BotCommandResponse, type BotDefinitionResponse, toBigInt64 } from "openchat-shared";
import { AssertError } from "@sinclair/typebox/value";
import { Type, type Static } from "@sinclair/typebox";
import { BotDefinition, BotMessageContent as MessageContent } from "../../typebox";
import { externalBotDefinition, messageContent } from "../common/chatMappersV2";
import { mapOptional } from "../../utils/mapping";
import { typeboxValidate } from "../../utils/typebox";

const ApiBotSuccess = Type.Object({
    message: Type.Optional(
        Type.Object({
            id: Type.String(),
            content: MessageContent,
            finalised: Type.Optional(Type.Boolean()),
            block_level_markdown: Type.Optional(Type.Boolean()),
            ephemeral: Type.Optional(Type.Boolean()),
        }),
    ),
});
type ApiBotSuccess = Static<typeof ApiBotSuccess>;

const ApiBotBadRequest = Type.Union([
    Type.Literal("AccessTokenNotFound"),
    Type.Literal("AccessTokenInvalid"),
    Type.Literal("AccessTokenExpired"),
    Type.Literal("CommandNotFound"),
    Type.Literal("ArgsInvalid"),
]);
type ApiBotBadRequest = Static<typeof ApiBotBadRequest>;

const ApiBotInternalError = Type.Any();
type ApiBotInternalError = Static<typeof ApiBotInternalError>;

const ApiBotResponse = Type.Union([
    Type.Object({
        Success: ApiBotSuccess,
    }),
    Type.Object({
        BadRequest: ApiBotBadRequest,
    }),
    Type.Object({
        InternalError: ApiBotInternalError,
    }),
    Type.Literal("TooManyRequests"),
]);
type ApiBotResponse = Static<typeof ApiBotResponse>;

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
        const value = typeboxValidate(json, BotDefinition);
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
        const value = typeboxValidate(json, ApiBotResponse);
        return externalBotResponse(value);
    } catch (err) {
        console.error("Parse error: ", JSON.stringify(err));
        return {
            kind: "internal_error",
            error: formatError(err),
        };
    }
}

function externalBotResponse(value: ApiBotResponse): BotCommandResponse {
    if (value === "TooManyRequests") {
        return {
            kind: "too_many_requests",
        };
    } else if ("Success" in value) {
        return {
            kind: "success",
            message: mapOptional(
                value.Success.message,
                ({ id, content, finalised, block_level_markdown, ephemeral }) => {
                    return {
                        messageId: toBigInt64(id),
                        messageContent: messageContent(content, ""),
                        finalised: finalised ?? false,
                        blockLevelMarkdown: block_level_markdown ?? false,
                        ephemeral: ephemeral ?? false,
                    };
                },
            ),
        };
    } else if ("BadRequest" in value) {
        return {
            kind: "bad_request",
            reason: value.BadRequest,
        };
    } else if ("InternalError" in value) {
        return {
            kind: "internal_error",
            error: value.InternalError,
        };
    }
    return {
        kind: "internal_error",
        error: "unknown",
    };
}

export function callBotCommandEndpoint(
    endpoint: string,
    token: string,
): Promise<BotCommandResponse> {
    const headers = new Headers();
    headers.append("Content-type", "text/plain");
    headers.append("x-oc-jwt", token);
    return fetch(`${endpoint}/execute_command`, {
        method: "POST",
        headers: headers,
    })
        .then(async (res) => {
            if (res.ok) {
                return { Success: await res.json() };
            } else if (res.status === 400) {
                return { BadRequest: await res.text() };
            } else if (res.status === 429) {
                return "TooManyRequests";
            } else {
                return { InternalError: await res.text() };
            }
        })
        .then(validateBotResponse)
        .catch((err) => {
            console.log("Bot command failed: ", err);
            return { kind: "internal_error", error: err };
        });
}
