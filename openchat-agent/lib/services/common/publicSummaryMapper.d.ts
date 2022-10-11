import type { GroupChatSummary } from "../../domain/chat/chat";
import type { ApiPublicGroupSummary, ApiPublicSummaryResponse } from "../../services/group/candid/idl";
export declare function publicGroupSummary(candid: ApiPublicGroupSummary): GroupChatSummary;
export declare function publicSummaryResponse(candid: ApiPublicSummaryResponse): GroupChatSummary | undefined;
