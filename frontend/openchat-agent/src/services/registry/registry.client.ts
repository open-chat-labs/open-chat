import type { HttpAgent, Identity } from "@dfinity/agent";
import type { RegistryUpdatesResponse } from "openchat-shared";
import { CandidService } from "../candidService";
import { updatesResponse } from "./mappers";
import { principalStringToBytes } from "../../utils/mapping";
import {
    RegistryAddMessageFilterArgs,
    RegistryAddMessageFilterResponse,
    RegistryRemoveMessageFilterArgs,
    RegistrySetTokenEnabledArgs,
    RegistrySetTokenEnabledResponse,
    RegistryUpdatesArgs,
    RegistryUpdatesResponse as TRegistryUpdatesResponse,
} from "../../typebox";

export class RegistryClient extends CandidService {
    private readonly blobUrlPattern: string;

    constructor(identity: Identity, agent: HttpAgent, canisterId: string, blobUrlPattern: string) {
        super(identity, agent, canisterId);

        this.blobUrlPattern = blobUrlPattern;
    }

    updates(since?: bigint): Promise<RegistryUpdatesResponse> {
        const args = {
            since,
        };
        return this.executeMsgpackQuery(
            "updates",
            args,
            (resp) => updatesResponse(resp, this.blobUrlPattern, this.canisterId),
            RegistryUpdatesArgs,
            TRegistryUpdatesResponse,
        );
    }

    addMessageFilter(regex: string): Promise<boolean> {
        return this.executeMsgpackUpdate(
            "add_message_filter",
            { regex },
            (resp) => {
                if (typeof resp !== "string" && "Success" in resp) {
                    console.log(`New message filter id: ${resp.Success}`);
                    return true;
                } else {
                    console.debug("Error calling add_message_filter", resp);
                    return false;
                }
            },
            RegistryAddMessageFilterArgs,
            RegistryAddMessageFilterResponse,
        );
    }

    removeMessageFilter(id: bigint): Promise<boolean> {
        return this.executeMsgpackUpdate(
            "remove_message_filter",
            { id },
            (resp) => typeof resp !== "string" && "Success" in resp,
            RegistryRemoveMessageFilterArgs,
            RegistryAddMessageFilterResponse,
        );
    }

    setTokenEnabled(ledger: string, enabled: boolean): Promise<boolean> {
        return this.executeMsgpackUpdate(
            "set_token_enabled",
            {
                ledger_canister_id: principalStringToBytes(ledger),
                enabled,
            },
            (resp) => typeof resp !== "string" && "Success" in resp,
            RegistrySetTokenEnabledArgs,
            RegistrySetTokenEnabledResponse,
        );
    }
}
