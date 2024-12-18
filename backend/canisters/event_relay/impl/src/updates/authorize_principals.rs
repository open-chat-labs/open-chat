use crate::guards::caller_is_registry_canister;
use crate::{mutate_state, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use event_relay_canister::authorize_principals::{Response::*, *};
use ic_cdk::update;
use tracing::info;

#[update(guard = "caller_is_registry_canister")]
#[trace]
fn authorize_principals(args: Args) -> Response {
    mutate_state(|state| authorize_principals_impl(args.principals, state))
}

fn authorize_principals_impl(principal: Vec<Principal>, state: &mut RuntimeState) -> Response {
    for principal in principal {
        if state.data.push_events_whitelist.insert(principal) {
            info!(%principal, "Principal authorized to push events");
        }
    }
    Success
}
