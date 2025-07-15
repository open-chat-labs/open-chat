use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use canister_tracing_macros::trace;
use escrow_canister::deposit_account::{Response::*, *};
use icrc_ledger_types::icrc1::account::Account;

#[query(candid = true, msgpack = true)]
#[trace]
fn deposit_accounts(args: Args) -> Response {
    read_state(|state| deposit_accounts_impl(args, state))
}

fn deposit_accounts_impl(args: Args, state: &RuntimeState) -> Response {
    if let Some(swap) = state.data.swaps.get(args.swap_id) {
        let principal = args.principal.unwrap_or(state.env.caller());

        if swap.offered_by != principal || swap.accept_by.is_some_and(|p| p != principal) {
            return PrincipalNotFound;
        }

        Success(Account {
            owner: state.env.canister_id(),
            subaccount: Some(escrow_canister::deposit_subaccount(principal, swap.id)),
        })
    } else {
        SwapNotFound
    }
}
