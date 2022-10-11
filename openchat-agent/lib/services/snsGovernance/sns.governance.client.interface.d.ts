import type { ListNervousSystemFunctionsResponse } from "../../domain/chat/chat";
export interface ISnsGovernanceClient {
    listNervousSystemFunctions(): Promise<ListNervousSystemFunctionsResponse>;
}
