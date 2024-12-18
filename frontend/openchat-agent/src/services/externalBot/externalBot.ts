import { type BotDefinitionResponse } from "openchat-shared";
import { Value, AssertError } from "@sinclair/typebox/value";
import { Type, type Static } from "@sinclair/typebox";
import { SlashCommandSchema } from "../../typebox";
import { externalBotDefinition } from "../common/chatMappersV2";

type ApiBotDefinition = Static<typeof ApiBotDefinition>;
const ApiBotDefinition = Type.Object({
    description: Type.String(),
    commands: Type.Array(SlashCommandSchema),
});

export function getBotDefinition(endpoint: string): Promise<BotDefinitionResponse> {
    return fetch(`${endpoint}/schema`)
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
