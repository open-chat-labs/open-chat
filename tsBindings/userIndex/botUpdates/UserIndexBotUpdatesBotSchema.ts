// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { SlashCommandSchema } from "../../shared/SlashCommandSchema";
import type { UserId } from "../../shared/UserId";

export type UserIndexBotUpdatesBotSchema = { id: UserId, owner: UserId, name: string, avatar_id?: bigint | undefined, endpoint: string, description: string, commands: Array<SlashCommandSchema>, last_updated: bigint, };