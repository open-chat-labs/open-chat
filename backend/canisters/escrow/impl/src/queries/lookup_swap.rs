use crate::{RuntimeState, read_state};
use candid::Principal;
use canister_api_macros::query;
use canister_tracing_macros::trace;
use escrow_canister::lookup_swap::{Response::*, *};
use icrc_ledger_types::icrc1::account::Account;
use types::CanisterId;

#[query(candid = true, msgpack = true)]
#[trace]
fn lookup_swap(args: Args) -> Response {
    read_state(|state| lookup_swap_impl(args, state))
}

fn lookup_swap_impl(args: Args, state: &RuntimeState) -> Response {
    let Some(swap) = state.data.swaps.get(args.swap_id) else {
        return SwapNotFound;
    };

    let accepting_principal = args.accepting_principal.unwrap_or(state.env.caller());

    let escrow_canister_id = state.env.canister_id();

    if swap.restricted_to.is_some_and(|p| p != accepting_principal) {
        return PrincipalNotFound;
    }

    Success(Swap {
        id: swap.id,
        location: swap.location.clone(),
        created_at: swap.created_at,
        offered_by: swap.offered_by,
        restricted_to: swap.restricted_to,
        token0: swap.token0.clone(),
        amount0: swap.amount0,
        token0_deposit_account: account(swap.offered_by, swap.id, escrow_canister_id),
        token1: swap.token1.clone(),
        amount1: swap.amount1,
        token1_deposit_account: account(accepting_principal, swap.id, escrow_canister_id),
        expires_at: swap.expires_at,
        additional_admins: swap.additional_admins.clone(),
        canister_to_notify: swap.canister_to_notify,
    })
}

fn account(principal: Principal, swap_id: u32, escrow_canister_id: CanisterId) -> Account {
    Account {
        owner: escrow_canister_id,
        subaccount: Some(escrow_canister::deposit_subaccount(principal, swap_id)),
    }
}
