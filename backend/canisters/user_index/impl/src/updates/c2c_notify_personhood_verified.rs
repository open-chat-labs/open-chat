use crate::guards::caller_is_personhood_verifier_canister;
use crate::{LocalUserIndexEvent, RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use event_store_producer::EventBuilder;
use serde::Serialize;
use types::{UniquePersonProof, UniquePersonProofProvider};
use user_index_canister::c2c_notify_personhood_verified::{Response::*, *};

#[update(guard = "caller_is_personhood_verifier_canister", msgpack = true)]
#[trace]
fn c2c_notify_personhood_verified(args: Args) -> Response {
    mutate_state(|state| c2c_notify_personhood_verified_impl(args, state))
}

fn c2c_notify_personhood_verified_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.users.get_by_user_id(&args.user_id).is_none() {
        return UserNotFound;
    }

    let now = state.env.now();
    let proof = UniquePersonProof {
        timestamp: now,
        provider: UniquePersonProofProvider::OpenChat,
        model_version: Some(args.model_version),
    };

    state
        .data
        .users
        .record_proof_of_unique_personhood(args.user_id, proof.clone(), now);
    state.push_event_to_all_local_user_indexes(LocalUserIndexEvent::NotifyUniquePersonProof(args.user_id, proof), None);
    state.data.event_store_client.push(
        EventBuilder::new("proof_of_uniqueness_submitted", now)
            .with_user(args.user_id.to_string(), true)
            .with_source(state.env.canister_id().to_string(), false)
            .with_json_payload(&EventPayload {
                provider: UniquePersonProofProvider::OpenChat,
            })
            .build(),
    );
    Success
}

#[derive(Serialize)]
struct EventPayload {
    provider: UniquePersonProofProvider,
}
