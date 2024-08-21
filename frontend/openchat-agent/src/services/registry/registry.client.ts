import type { HttpAgent, Identity } from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import type { RegistryUpdatesResponse } from "openchat-shared";
import { idlFactory, type RegistryService } from "./candid/idl";
import { CandidService } from "../candidService";
import { updatesResponse } from "./mappers";
import { apiOptional } from "../common/chatMappers";
import { identity } from "../../utils/mapping";

export class RegistryClient extends CandidService {
    private readonly service: RegistryService;
    private readonly blobUrlPattern: string;

    constructor(identity: Identity, agent: HttpAgent, canisterId: string, blobUrlPattern: string) {
        super(identity, agent, canisterId);

        this.service = this.createServiceClient<RegistryService>(idlFactory);
        this.blobUrlPattern = blobUrlPattern;
    }

    updates(since?: bigint): Promise<RegistryUpdatesResponse> {
        const args = {
            since: apiOptional(identity, since),
        };
        return this.handleQueryResponse(
            () => this.service.updates(args),
            (resp) => updatesResponse(resp, this.blobUrlPattern, this.canisterId),
        );
    }

    addMessageFilter(regex: string): Promise<boolean> {
        return this.handleResponse(this.service.add_message_filter({ regex }), (resp) => {
            if ("Success" in resp) {
                console.log(`New message filter id: ${resp.Success}`);
                return true;
            } else {
                console.debug("Error calling add_message_filter", resp);
                return false;
            }
        });
    }

    removeMessageFilter(id: bigint): Promise<boolean> {
        return this.handleResponse(
            this.service.remove_message_filter({ id }),
            (resp) => "Success" in resp,
        );
    }

    setTokenEnabled(ledger: string, enabled: boolean): Promise<boolean> {
        return this.handleResponse(
            this.service.set_token_enabled({
                ledger_canister_id: Principal.fromText(ledger),
                enabled,
            }),
            (resp) => "Success" in resp,
        );
    }
}
