import type { HttpAgent, Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { idlFactory, type ProposalsBotService } from "./candid/idl";
import { CandidService } from "../candidService";
import type {
    StakeNeuronForSubmittingProposalsResponse,
    TopUpNeuronResponse,
} from "openchat-shared";
import { stakeNeuronForSubmittingProposalsResponse, topUpNeuronResponse } from "./mappers";

export class ProposalsBotClient extends CandidService {
    private service: ProposalsBotService;

    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId);

        this.service = this.createServiceClient<ProposalsBotService>(idlFactory);
    }

    stakeNeuronForSubmittingProposals(
        governanceCanisterId: string,
        stake: bigint,
    ): Promise<StakeNeuronForSubmittingProposalsResponse> {
        const args = {
            governance_canister_id: Principal.fromText(governanceCanisterId),
            stake,
        };
        return this.handleResponse(
            this.service.stake_neuron_for_submitting_proposals(args),
            stakeNeuronForSubmittingProposalsResponse,
            args,
        );
    }

    topUpNeuron(governanceCanisterId: string, amount: bigint): Promise<TopUpNeuronResponse> {
        const args = {
            governance_canister_id: Principal.fromText(governanceCanisterId),
            amount,
        };
        return this.handleResponse(this.service.top_up_neuron(args), topUpNeuronResponse);
    }
}
