import {
    type BotActionResponse,
    type BotCommandResponse,
    type BotDefinitionResponse,
    toBigInt64,
} from "@shared";
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

const ApiBotBadRequest = Type.Any();
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

// A bot's answer to a button press: an optional reply shown only to whoever pressed it
const ApiBotActionSuccess = Type.Object({
    message: Type.Optional(
        Type.Object({
            content: MessageContent,
            block_level_markdown: Type.Optional(Type.Boolean()),
        }),
    ),
});

/**
 * Tells a bot that one of its MiniApp message's buttons was pressed, vouched for by the user's
 * session token for the message. `token_rejected` (401): the bot didn't accept the token, eg. as it
 * had expired, so a fresh one is worth trying.
 */
export async function callBotActionEndpoint(
    endpoint: string,
    token: string,
    buttonId: string,
): Promise<BotActionResponse | "token_rejected"> {
    try {
        const res = await fetch(`${endpoint}/execute_action`, {
            method: "POST",
            headers: { "Content-type": "application/json", "x-oc-jwt": token },
            body: JSON.stringify({ button_id: buttonId }),
        });
        if (res.status === 401) return "token_rejected";
        if (res.status === 400) return { kind: "bad_request", reason: await res.text() };
        if (res.status === 429) return { kind: "too_many_requests" };
        if (!res.ok) return { kind: "internal_error", error: await res.text() };

        // The bot has acted, so a reply it sent which can't be shown is dropped rather than the
        // press being reported as failed, which would have the user press again
        try {
            const value = typeboxValidate(await res.json(), ApiBotActionSuccess);
            return {
                kind: "success",
                reply: mapOptional(value.message, ({ content, block_level_markdown }) => ({
                    messageContent: messageContent(content, ""),
                    blockLevelMarkdown: block_level_markdown ?? false,
                })),
            };
        } catch (err) {
            console.log("Bot action's reply can't be shown: ", formatError(err));
            return { kind: "success" };
        }
    } catch (err) {
        console.log("Bot action failed: ", err);
        return { kind: "internal_error", error: formatError(err) };
    }
}

export function getBotDefinition(endpoint: string): Promise<BotDefinitionResponse> {
    return fetch(`${endpoint}/bot_definition`).then(async (res): Promise<BotDefinitionResponse> => {
        if (!res.ok) {
            const msg = `Failed to load external bot schema: ${res.status}, ${
                res.statusText
            }, ${JSON.stringify(endpoint)}`;
            return {
                kind: "bot_definition_failure",
                error: msg,
            };
        }
        // The endpoint is supplied by the bot's developer and may answer 200 with a body which
        // isn't JSON (e.g. an HTML page), which is a bad definition rather than our failure
        let json: unknown;
        try {
            json = await res.json();
        } catch (err) {
            return {
                kind: "bot_definition_failure",
                error: `External bot schema is not valid JSON: ${JSON.stringify(endpoint)}, ${err}`,
            };
        }
        return validateBotDefinition(json);
    });
}

function validateBotDefinition(json: unknown): BotDefinitionResponse {
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
            // TODO handle the various types
            reason: JSON.stringify(value.BadRequest),
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
