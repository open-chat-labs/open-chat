import type { CreateGroupChatResponse } from "../../domain/chat/chat";
import type { ApiCreateResponse } from "./candid/idl";

export function createResponse(candid: ApiCreateResponse): CreateGroupChatResponse {
    if ("Success" in candid) {
        return candid.Success.canister_id.toString();
    }
    // todo - come back and fill this in once the candid is correct
    throw new Error(`Unexpected ApiCreateResponse type received: ${candid}`);
}
