import type { GetCurrentUserResponse } from "../../domain/user";

export function fromCandid(_candid: unknown): GetCurrentUserResponse {
    // return {
    //     kind: "success",
    //     user: {
    //         username: "julian_jelfs",
    //     },
    // };
    return {
        kind: "unknown",
    };
}
