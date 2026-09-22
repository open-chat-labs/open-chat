use crate::crypto::deposit_to_accept_p2p_swap;
use crate::guards::caller_is_known_group_or_community_canister;
use crate::{RuntimeState, execute_update_async, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::{CanisterId, OCResult, TimestampMillis, UserId};
use user_canister::c2c_accept_p2p_swap::{Response::*, *};
use user_core::updates::c2c_accept_p2p_swap::{deposited, prepare as prepare_acceptance};

#[update(guard = "caller_is_known_group_or_community_canister", msgpack = true)]
#[trace]
async fn c2c_accept_p2p_swap(args: Args) -> Response {
    execute_update_async(|| c2c_accept_p2p_swap_impl(args)).await
}

async fn c2c_accept_p2p_swap_impl(mut args: Args) -> Response {
    let PrepareResult {
        my_user_id,
        escrow_canister_id,
        now,
    } = match mutate_state(|state| prepare(&mut args, state)) {
        Ok(ok) => ok,
        Err(response) => return Error(response),
    };

    match deposit_to_accept_p2p_swap(
        escrow_canister_id,
        my_user_id,
        args.swap_id,
        &args.token1,
        args.token1_amount,
        now,
        args.from_account,
    )
    .await
    {
        Ok(block_index) => {
            mutate_state(|state| deposited(&mut state.data.user, args));
            Success(block_index)
        }
        Err(error) => Error(error),
    }
}

struct PrepareResult {
    my_user_id: UserId,
    escrow_canister_id: CanisterId,
    now: TimestampMillis,
}

fn prepare(args: &mut Args, state: &mut RuntimeState) -> OCResult<PrepareResult> {
    let my_user_id: UserId = state.env.canister_id().into();
    let now = state.env.now();
    prepare_acceptance(&mut state.data.user, my_user_id, args, now)?;
    Ok(PrepareResult {
        my_user_id,
        escrow_canister_id: state.data.escrow_canister_id,
        now,
    })
}
