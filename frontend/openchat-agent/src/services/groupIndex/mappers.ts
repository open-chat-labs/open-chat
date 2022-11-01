import { optional } from "../../utils/mapping";
import type { GroupMatch, GroupSearchResponse } from "openchat-shared";
import type { ApiGroupMatch, ApiSearchResponse } from "./candid/idl";

export function groupSearchResponse(candid: ApiSearchResponse): GroupSearchResponse {
    if ("Success" in candid) {
        return {
            kind: "success",
            matches: candid.Success.matches.map(groupMatch),
        };
    }
    throw new Error(`Unknown GroupIndex.SearchResponse of ${candid}`);
}

function groupMatch(candid: ApiGroupMatch): GroupMatch {
    return {
        chatId: candid.chat_id.toString(),
        name: candid.name,
        description: candid.description,
        blobReference: optional(candid.avatar_id, (blobId) => ({
            blobId,
            canisterId: candid.chat_id.toString(),
        })),
    };
}
