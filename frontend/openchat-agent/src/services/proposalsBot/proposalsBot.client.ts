import type { Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { idlFactory, type ProposalsBotService } from "./candid/idl";
import { CandidService } from "../candidService";
import type { AgentConfig } from "../../config";
import type {
    StakeNeuronForSubmittingProposalsResponse,
    TopUpNeuronResponse,
} from "openchat-shared";
import { stakeNeuronForSubmittingProposalsResponse, topUpNeuronResponse } from "./mappers";

export class ProposalsBotClient extends CandidService {
    private service: ProposalsBotService;

    private constructor(identity: Identity, config: AgentConfig) {
        super(identity);

        this.service = this.createServiceClient<ProposalsBotService>(
            idlFactory,
            config.proposalBotCanister,
            config,
        );
    }

    static create(identity: Identity, config: AgentConfig): ProposalsBotClient {
        return new ProposalsBotClient(identity, config);
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
