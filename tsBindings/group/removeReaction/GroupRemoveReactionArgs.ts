// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { MessageId } from "../../shared/MessageId";
import type { MessageIndex } from "../../shared/MessageIndex";
import type { Reaction } from "../../shared/Reaction";
import type { TSBigIntWithDefault } from "../../shared/TSBigIntWithDefault";

export type GroupRemoveReactionArgs = { thread_root_message_index?: MessageIndex | undefined, message_id: MessageId, reaction: Reaction, correlation_id: TSBigIntWithDefault, };
