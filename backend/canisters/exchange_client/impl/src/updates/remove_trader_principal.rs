use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, RuntimeState};
use canister_tracing_macros::trace;
use exchange_client_canister::remove_trader_principal::{Response::*, *};
use ic_cdk_macros::update;
use std::collections::hash_map::Entry::Occupied;

#[update(guard = "caller_is_governance_principal")]
#[trace]
fn remove_trader_principal(args: Args) -> Response {
    mutate_state(|state| remove_trader_principal_impl(args, state))
}

fn remove_trader_principal_impl(args: Args, state: &mut RuntimeState) -> Response {
    if let Occupied(mut e) = state.data.trader_principals.entry(args.principal) {
        let set = e.get_mut();
        if let Some(exchange_ids) = args.exchange_ids {
            for exchange_id in exchange_ids {
                set.remove(&exchange_id);
            }
        }
        if set.is_empty() {
            e.remove();
        }
    }
    Success
}
