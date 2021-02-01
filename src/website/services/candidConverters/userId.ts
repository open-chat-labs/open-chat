import { Principal } from "@dfinity/agent";

import { UserId } from "../../model/users";

export function fromCandid(value: Principal) : UserId {
    return value.toString();
}

export function toCandid(userId: UserId) : Principal {
    return Principal.fromText(userId);
}
