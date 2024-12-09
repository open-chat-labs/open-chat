use candid::Principal;
use ic_verifiable_credentials::issuer_api::CredentialSpec;
use ic_verifiable_credentials::VcFlowSigners;
use types::{CanisterId, TimestampMillis, UniquePersonProof, UniquePersonProofProvider};

const ISSUER_CANISTER_ID: CanisterId = CanisterId::from_slice(&[0, 0, 0, 0, 0, 240, 24, 173, 1, 1]);
const ISSUER_ORIGIN: &str = "https://id.decideai.xyz/";
const NANOS_PER_MILLISECOND: u64 = 1_000_000;

pub fn verify_proof_of_unique_personhood(
    principal: Principal,
    internet_identity_canister_id: CanisterId,
    website_canister_id: CanisterId,
    credential_jwt: &str,
    ic_root_key: &[u8],
    now: TimestampMillis,
) -> Result<UniquePersonProof, String> {
    let root_pk_raw = &ic_root_key[ic_root_key.len().saturating_sub(96)..];

    match ic_verifiable_credentials::validate_ii_presentation_and_claims(
        credential_jwt,
        principal,
        format!("https://{website_canister_id}.ic0.app"),
        &VcFlowSigners {
            ii_canister_id: internet_identity_canister_id,
            ii_origin: "https://identity.ic0.app".to_string(),
            issuer_canister_id: ISSUER_CANISTER_ID,
            issuer_origin: ISSUER_ORIGIN.to_string(),
        },
        &CredentialSpec {
            credential_type: "ProofOfUniqueness".to_string(),
            arguments: None,
        },
        root_pk_raw,
        (now * NANOS_PER_MILLISECOND) as u128,
    ) {
        Ok(_) => Ok(UniquePersonProof {
            timestamp: now,
            provider: UniquePersonProofProvider::DecideAI,
        }),
        Err(error) => Err(format!("{error:?}")),
    }
}

#[test]
fn signing_canister_id() {
    assert_eq!(
        ISSUER_CANISTER_ID,
        CanisterId::from_text("qgxyr-pyaaa-aaaah-qdcwq-cai").unwrap()
    );
}
