import { Principal } from "@dfinity/principal";

import { UserId } from "../../domain/model/users";

export function fromCandid(value: Principal) : UserId {
    return value.toString();
}

export function toCandid(userId: UserId) : Principal {
    return Principal.fromText(userId);
}
