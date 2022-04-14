import type { GroupMatch, GroupSearchResponse } from "../../domain/search/searchort { optional } from "../../../utils/mappingort type { ApiGroupMatch, ApiSearchResponse } from "./candid/idl";
../../utils/mapping
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
