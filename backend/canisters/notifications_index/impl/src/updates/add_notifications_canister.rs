use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, read_state, NotificationsCanister, RuntimeState};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use notifications_index_canister::add_notifications_canister::{Response::*, *};
use notifications_index_canister::{NotificationsIndexEvent, SubscriptionAdded};
use std::collections::hash_map::Entry::Vacant;
use types::{CanisterId, CanisterWasm, Version};
use utils::canister::install;

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn add_notifications_canister(args: Args) -> Response {
    match read_state(|state| prepare(args.canister_id, args.authorizers, state)) {
        Ok(result) => {
            match install(
                args.canister_id,
                result.canister_wasm.module,
                candid::encode_one(result.init_args).unwrap(),
            )
            .await
            {
                Ok(_) => mutate_state(|state| commit(args.canister_id, result.canister_wasm.version, state)),
                Err(error) => InternalError(format!("{error:?}")),
            }
        }
        Err(response) => response,
    }
}

struct PrepareResult {
    canister_wasm: CanisterWasm,
    init_args: notifications_canister::init::Args,
}

fn prepare(
    canister_id: CanisterId,
    authorizers: Vec<CanisterId>,
    runtime_state: &RuntimeState,
) -> Result<PrepareResult, Response> {
    if !runtime_state.data.notifications_canisters.contains_key(&canister_id) {
        Ok(PrepareResult {
            canister_wasm: runtime_state.data.notifications_canister_wasm.clone(),
            init_args: notifications_canister::init::Args {
                notifications_index_canister_id: runtime_state.env.canister_id(),
                push_service_principals: runtime_state.data.push_service_principals.iter().copied().collect(),
                authorizers,
                cycles_dispenser_canister_id: runtime_state.data.cycles_dispenser_canister_id,
                wasm_version: runtime_state.data.notifications_canister_wasm.version,
                test_mode: runtime_state.data.test_mode,
            },
        })
    } else {
        Err(AlreadyAdded)
    }
}

fn commit(canister_id: CanisterId, wasm_version: Version, runtime_state: &mut RuntimeState) -> Response {
    if let Vacant(e) = runtime_state.data.notifications_canisters.entry(canister_id) {
        let now = runtime_state.env.now();
        e.insert(NotificationsCanister::new(wasm_version, now));

        for (user_id, subscription) in runtime_state
            .data
            .subscriptions
            .iter()
            .flat_map(|(user_id, subs)| subs.iter().map(|s| (*user_id, s.clone())))
        {
            runtime_state.data.notifications_index_event_sync_queue.push(
                canister_id,
                NotificationsIndexEvent::SubscriptionAdded(SubscriptionAdded { user_id, subscription }),
            );
        }

        Success
    } else {
        AlreadyAdded
    }
}
