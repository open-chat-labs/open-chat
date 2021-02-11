import BigNumber from "bignumber.js";

import { ChatId } from "../../domain/model/chats";

export function fromCandid(value: BigNumber) : ChatId {
    return BigInt(value);
}

export function toCandid(chatId: ChatId) : BigNumber {
    return new BigNumber(chatId.toString());
}