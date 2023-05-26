use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, read_state, NotificationsCanister, RuntimeState};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use ic_cdk::api::management_canister::main::CanisterInstallMode;
use notifications_index_canister::add_notifications_canister::{Response::*, *};
use notifications_index_canister::{NotificationsIndexEvent, SubscriptionAdded};
use std::collections::hash_map::Entry::Vacant;
use types::{CanisterId, CanisterWasm, Version};
use utils::canister::{install, CanisterToInstall};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn add_notifications_canister(args: Args) -> Response {
    match read_state(|state| prepare(args.canister_id, args.authorizers, state)) {
        Ok(result) => {
            let wasm_version = result.canister_wasm.version;
            match install(CanisterToInstall {
                canister_id: args.canister_id,
                current_wasm_version: Version::default(),
                new_wasm: result.canister_wasm,
                deposit_cycles_if_needed: true,
                args: result.init_args,
                mode: CanisterInstallMode::Install,
                stop_start_canister: false,
            })
            .await
            {
                Ok(_) => mutate_state(|state| commit(args.canister_id, wasm_version, state)),
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

fn prepare(canister_id: CanisterId, authorizers: Vec<CanisterId>, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if !state.data.notifications_canisters.contains_key(&canister_id) {
        Ok(PrepareResult {
            canister_wasm: state.data.notifications_canister_wasm_for_new_canisters.clone(),
            init_args: notifications_canister::init::Args {
                notifications_index_canister_id: state.env.canister_id(),
                push_service_principals: state.data.push_service_principals.iter().copied().collect(),
                authorizers,
                cycles_dispenser_canister_id: state.data.cycles_dispenser_canister_id,
                wasm_version: state.data.notifications_canister_wasm_for_new_canisters.version,
                test_mode: state.data.test_mode,
            },
        })
    } else {
        Err(AlreadyAdded)
    }
}

fn commit(canister_id: CanisterId, wasm_version: Version, state: &mut RuntimeState) -> Response {
    if let Vacant(e) = state.data.notifications_canisters.entry(canister_id) {
        let now = state.env.now();
        e.insert(NotificationsCanister::new(wasm_version, now));

        for (user_id, subscription) in state
            .data
            .subscriptions
            .iter()
            .flat_map(|(user_id, subs)| subs.iter().map(|s| (*user_id, s.clone())))
        {
            state.data.notifications_index_event_sync_queue.push(
                canister_id,
                NotificationsIndexEvent::SubscriptionAdded(SubscriptionAdded { user_id, subscription }),
            );
        }

        Success
    } else {
        AlreadyAdded
    }
}
