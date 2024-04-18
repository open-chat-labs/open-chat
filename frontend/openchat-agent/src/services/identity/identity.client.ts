import type { Identity, SignIdentity } from "@dfinity/agent";
import { idlFactory, type IdentityService } from "./candid/idl";
import { CandidService } from "../candidService";
import type {
    ChallengeAttempt,
    CheckAuthPrincipalResponse,
    CreateIdentityResponse,
    GetDelegationResponse,
    MigrateLegacyPrincipalResponse,
    PrepareDelegationResponse,
} from "openchat-shared";
import {
    checkAuthPrincipalResponse,
    createIdentityResponse,
    getDelegationResponse,
    migrateLegacyPrincipalResponse,
    prepareDelegationResponse,
} from "./mappers";
import type { CreateIdentityArgs } from "./candid/types";
import { apiOptional } from "../common/chatMappers";
import { identity } from "../../utils/mapping";

export class IdentityClient extends CandidService {
    private service: IdentityService;

    private constructor(identity: Identity, identityCanister: string, icUrl: string) {
        super(identity);

        this.service = this.createServiceClient<IdentityService>(idlFactory, identityCanister, {
            icUrl,
        });
    }

    static create(identity: Identity, identityCanister: string, icUrl: string): IdentityClient {
        return new IdentityClient(identity, identityCanister, icUrl);
    }

    createIdentity(
        sessionKey: Uint8Array,
        challengeAttempt: ChallengeAttempt | undefined,
    ): Promise<CreateIdentityResponse> {
        const args: CreateIdentityArgs = {
            public_key: new Uint8Array((this.identity as SignIdentity).getPublicKey().toDer()),
            session_key: sessionKey,
            max_time_to_live: [] as [] | [bigint],
            challenge_attempt: apiOptional(identity, challengeAttempt),
        };
        return this.handleResponse(
            this.service.create_identity(args),
            createIdentityResponse,
            args,
        );
    }

    checkAuthPrincipal(): Promise<CheckAuthPrincipalResponse> {
        return this.handleQueryResponse(
            () => this.service.check_auth_principal({}),
            checkAuthPrincipalResponse,
            {},
        );
    }

    migrateLegacyPrincipal(): Promise<MigrateLegacyPrincipalResponse> {
        return this.handleResponse(
            this.service.migrate_legacy_principal({}),
            migrateLegacyPrincipalResponse,
            {},
        );
    }

    prepareDelegation(sessionKey: Uint8Array): Promise<PrepareDelegationResponse> {
        const args = {
            session_key: sessionKey,
            max_time_to_live: [] as [] | [bigint],
        };
        return this.handleResponse(
            this.service.prepare_delegation(args),
            prepareDelegationResponse,
            args,
        );
    }

    getDelegation(sessionKey: Uint8Array, expiration: bigint): Promise<GetDelegationResponse> {
        const args = {
            session_key: sessionKey,
            expiration,
        };
        return this.handleQueryResponse(
            () => this.service.get_delegation(args),
            getDelegationResponse,
            args,
        );
    }

    setPrincipalMigrationJobEnabled(enabled: boolean): Promise<void> {
        return this.handleResponse(
            this.service.set_principal_migration_job_enabled({ enabled }),
            (_) => {},
        );
    }
}
