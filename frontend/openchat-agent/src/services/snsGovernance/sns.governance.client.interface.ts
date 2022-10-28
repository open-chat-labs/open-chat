import type { ListNervousSystemFunctionsResponse } from "openchat-shared";

export interface ISnsGovernanceClient {
    listNervousSystemFunctions(): Promise<ListNervousSystemFunctionsResponse>;
}
