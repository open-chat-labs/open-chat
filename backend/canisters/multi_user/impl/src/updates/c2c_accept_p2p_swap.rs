use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{CanisterId, OCResult, TimestampMillis};
use user_canister::c2c_accept_p2p_swap::{Response::*, *};
use user_core::updates::c2c_accept_p2p_swap::{deposited, prepare as prepare_acceptance};

// Called by a group or community the user is in, which has recorded their acceptance of a swap
// offered there. As in the User canister, the deposit of token1 is made into the escrow canister
// from the user's account (one of this canister's subaccounts) or the one they approved.
#[update(msgpack = true)]
#[trace]
async fn c2c_accept_p2p_swap(mut args: Args) -> Response {
    let PrepareOk {
        user_index,
        escrow_canister_id,
        now,
    } = match mutate_state(|state| prepare(&mut args, state)) {
        Ok(ok) => ok,
        Err(error) => return Error(error),
    };

    match ledger_utils::deposit_to_accept_p2p_swap(
        escrow_canister_id,
        args.user_id,
        args.swap_id,
        &args.token1,
        args.token1_amount,
        now,
        args.from_account,
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
    escrow_canister_id: CanisterId,
    now: TimestampMillis,
}

fn prepare(args: &mut Args, state: &mut RuntimeState) -> OCResult<PrepareOk> {
    let caller = state.env.caller();
    let now = state.env.now();
    let user_index = state
        .index_of_local_user(args.user_id)
        .ok_or(OCErrorCode::TargetUserNotFound)?;
    let my_user_id = args.user_id;
    state
        .data
        .users
        .with_user_mut(user_index, |user| {
            // Only a group or community the user is in may accept a swap for them
            if !user.group_chats.exists(&caller.into()) && !user.communities.exists(&caller.into()) {
                return Err(OCErrorCode::InitiatorNotAuthorized.into());
            }
            prepare_acceptance(user, my_user_id, args, now)
        })
        .unwrap_or(Err(OCErrorCode::TargetUserNotFound.into()))?;
    Ok(PrepareOk {
        user_index,
        escrow_canister_id: state.data.escrow_canister_id,
        now,
    })
}
