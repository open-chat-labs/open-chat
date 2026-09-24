use crate::{RuntimeState, mutate_state};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use ledger_utils::{Payer, deposit_to_accept_p2p_swap};
use oc_error_codes::OCErrorCode;
use types::{CanisterId, OCResult, TimestampMillis};
use user_canister::c2c_accept_p2p_swap::{Response::*, *};
use user_core::updates::c2c_accept_p2p_swap::{deposited, prepare};

// The User canister's `c2c_accept_p2p_swap`, by which a group or community has the user deposit
// token1 into the escrow canister to accept a swap in one of its chats, having reserved the swap
// for them. The deposit is pulled from the user's wallet (or the account they name) via ICRC2,
// against an approval made under their own spender subaccount, into the escrow canister's account
// for them under their principal, which the group or community names them by too.
#[update(msgpack = true)]
#[trace]
async fn c2c_accept_p2p_swap(mut args: Args) -> Response {
    let PrepareOk {
        user_index,
        principal,
        escrow_canister_id,
        now,
    } = match mutate_state(|state| prepare_impl(&mut args, state)) {
        Ok(ok) => ok,
        Err(error) => return Error(error),
    };

    let payer = Payer::Approved {
        from: args.from_account.unwrap_or(principal.into()),
        spender_subaccount: Some(ledger_utils::spender_subaccount(principal)),
    };
    match deposit_to_accept_p2p_swap(
        escrow_canister_id,
        principal,
        args.swap_id,
        &args.token1,
        args.token1_amount,
        now,
        payer,
    )
    .await
    {
        Ok(block_index) => {
            mutate_state(|state| state.data.users.with_user_mut(user_index, |user| deposited(user, args)));
            Success(block_index)
        }
        Err(error) => Error(error),
    }
}

struct PrepareOk {
    user_index: u16,
    principal: Principal,
    escrow_canister_id: CanisterId,
    now: TimestampMillis,
}

fn prepare_impl(args: &mut Args, state: &mut RuntimeState) -> OCResult<PrepareOk> {
    let user_index = state
        .index_of_local_user(args.user_id)
        .ok_or(OCErrorCode::TargetUserNotFound)?;
    let caller = state.env.caller();
    let this_canister_id = state.env.canister_id();
    let now = state.env.now();
    let principal = state
        .data
        .users
        .with_user_mut(user_index, |user| {
            // As the User canister's guard does, only a group or community the user is in may have
            // them deposit
            if !user.group_chats.exists(&caller.into()) && !user.communities.exists(&caller.into()) {
                return Err(OCErrorCode::InitiatorNotAuthorized.into());
            }
            prepare(user, this_canister_id, args, now).map(|_| user.principal)
        })
        .ok_or(OCErrorCode::TargetUserNotFound)??;

    Ok(PrepareOk {
        user_index,
        principal,
        escrow_canister_id: state.data.escrow_canister_id,
        now,
    })
}
