import type {
    Avatar,
    UpdateProposalsGroupResponse,
} from "openchat-shared";

export interface IProposalsBotClient {
    updateGroupDetails(
        governanceCanisterId: string, 
        name?: string,
        desc?: string,
        avatar?: Avatar): Promise<UpdateProposalsGroupResponse>;
}
