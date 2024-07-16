use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use event_store_producer::EventBuilder;
use ic_cdk::update;
use ic_verifiable_credentials::issuer_api::CredentialSpec;
use ic_verifiable_credentials::VcFlowSigners;
use serde::Serialize;
use types::{CanisterId, UniquePersonProof, UniquePersonProofProvider};
use user_index_canister::submit_proof_of_unique_personhood::{Response::*, *};
use utils::time::NANOS_PER_MILLISECOND;

const ISSUER_CANISTER_ID: CanisterId = CanisterId::from_slice(&[0, 0, 0, 0, 0, 240, 24, 173, 1, 1]);
const ISSUER_ORIGIN: &str = "id.decideai.xyz";

#[update]
#[trace]
fn submit_proof_of_unique_personhood(args: Args) -> Response {
    mutate_state(|state| submit_proof_of_unique_personhood_impl(args, state))
}

fn submit_proof_of_unique_personhood_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    let Some(user_id) = state.data.users.get_by_principal(&caller).map(|u| u.user_id) else {
        return UserNotFound;
    };

    let now = state.env.now();
    match ic_verifiable_credentials::validate_ii_presentation_and_claims(
        &args.credential_jwt,
        caller,
        &VcFlowSigners {
            ii_canister_id: state.data.internet_identity_canister_id,
            ii_origin: "identity.ic0.app".to_string(),
            issuer_canister_id: ISSUER_CANISTER_ID,
            issuer_origin: ISSUER_ORIGIN.to_string(),
        },
        &CredentialSpec {
            credential_type: "ProofOfUniqueness".to_string(),
            arguments: None,
        },
        &state.data.ic_root_key,
        (now * NANOS_PER_MILLISECOND) as u128,
    ) {
        Ok(_) => {
            let proof = UniquePersonProof {
                timestamp: now,
                provider: UniquePersonProofProvider::DecideAI,
            };
            state.data.users.record_proof_of_unique_personhood(user_id, proof.clone());
            state.push_event_to_all_local_user_indexes(
                local_user_index_canister::Event::NotifyUniquePersonProof(user_id, proof),
                None,
            );
            state.data.event_store_client.push(
                EventBuilder::new("proof_of_uniqueness_submitted", now)
                    .with_user(user_id.to_string(), true)
                    .with_source(state.env.canister_id().to_string(), false)
                    .with_json_payload(&EventPayload {
                        provider: UniquePersonProofProvider::DecideAI,
                    })
                    .build(),
            );
            Success
        }
        Err(error) => Invalid(format!("{error:?}")),
    }
}

#[derive(Serialize)]
struct EventPayload {
    provider: UniquePersonProofProvider,
}

#[test]
fn signing_canister_id() {
    let canister_id = CanisterId::from_text("qgxyr-pyaaa-aaaah-qdcwq-cai").unwrap();
    assert_eq!(canister_id, ISSUER_CANISTER_ID);
}
