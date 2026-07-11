import type { HttpAgent, Identity } from "@icp-sdk/core/agent";
import type {
    StartVerificationResponse,
    SubmitVerificationResponse,
    UploadVerificationFrameResponse,
    VerificationStatus,
} from "@shared";
import {
    Empty,
    PersonhoodVerifierStartVerificationResponse,
    PersonhoodVerifierSubmitVerificationArgs,
    PersonhoodVerifierSubmitVerificationResponse,
    PersonhoodVerifierUploadFrameArgs,
    PersonhoodVerifierUploadFrameResponse,
    PersonhoodVerifierVerificationStatusArgs,
    PersonhoodVerifierVerificationStatusResponse,
} from "../../typebox";
import { SingleCanisterMsgpackAgent } from "../canisterAgent/msgpack";
import {
    startVerificationResponse,
    submitVerificationResponse,
    uploadFrameResponse,
    verificationStatusResponse,
} from "./mappers";

// Talks to the personhood_verifier canister (#9072). When no verifier
// canister is configured the MockVerifierClient is used instead.
export class VerifierClient extends SingleCanisterMsgpackAgent {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string) {
        super(identity, agent, canisterId, "PersonhoodVerifier");
    }

    startVerification(): Promise<StartVerificationResponse> {
        return this.update(
            "start_verification",
            {},
            startVerificationResponse,
            Empty,
            PersonhoodVerifierStartVerificationResponse,
        );
    }

    uploadVerificationFrame(
        sessionId: bigint,
        challengeIndex: number,
        image: Uint8Array,
    ): Promise<UploadVerificationFrameResponse> {
        return this.update(
            "upload_frame",
            {
                session_id: sessionId,
                challenge_index: challengeIndex,
                image,
            },
            uploadFrameResponse,
            PersonhoodVerifierUploadFrameArgs,
            PersonhoodVerifierUploadFrameResponse,
        );
    }

    submitVerification(sessionId: bigint): Promise<SubmitVerificationResponse> {
        return this.update(
            "submit_verification",
            { session_id: sessionId },
            submitVerificationResponse,
            PersonhoodVerifierSubmitVerificationArgs,
            PersonhoodVerifierSubmitVerificationResponse,
        );
    }

    verificationStatus(sessionId: bigint): Promise<VerificationStatus> {
        return this.query(
            "verification_status",
            { session_id: sessionId },
            verificationStatusResponse,
            PersonhoodVerifierVerificationStatusArgs,
            PersonhoodVerifierVerificationStatusResponse,
        );
    }
}
