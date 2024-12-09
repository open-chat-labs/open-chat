use crate::{mutate_state, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use event_store_producer::EventBuilder;
use proof_of_unique_personhood::verify_proof_of_unique_personhood;
use serde::Serialize;
use types::UniquePersonProofProvider;
use user_index_canister::submit_proof_of_unique_personhood::{Response::*, *};

#[update(msgpack = true)]
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
    match verify_proof_of_unique_personhood(
        args.user_ii_principal,
        state.data.internet_identity_canister_id,
        state.data.website_canister_id,
        &args.credential_jwt,
        &state.data.ic_root_key,
        now,
    ) {
        Ok(proof) => {
            state
                .data
                .users
                .record_proof_of_unique_personhood(user_id, proof.clone(), now);
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
        Err(error) => Invalid(error),
    }
}

#[derive(Serialize)]
struct EventPayload {
    provider: UniquePersonProofProvider,
}
