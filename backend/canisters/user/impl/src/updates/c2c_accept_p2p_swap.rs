use crate::guards::caller_is_known_group_or_community_canister;
use crate::{RuntimeState, execute_update_async, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use ledger_utils::{Payer, deposit_to_accept_p2p_swap};
use types::{CanisterId, OCResult, TimestampMillis};
use user_canister::c2c_accept_p2p_swap::{Response::*, *};
use user_core::updates::c2c_accept_p2p_swap::{deposited, prepare};

#[update(guard = "caller_is_known_group_or_community_canister", msgpack = true)]
#[trace]
async fn c2c_accept_p2p_swap(args: Args) -> Response {
    execute_update_async(|| c2c_accept_p2p_swap_impl(args)).await
}

async fn c2c_accept_p2p_swap_impl(mut args: Args) -> Response {
    let PrepareResult {
        my_canister_id,
        escrow_canister_id,
        now,
    } = match mutate_state(|state| prepare_impl(&mut args, state)) {
        Ok(ok) => ok,
        Err(error) => return Error(error),
    };

    // The user's funds are in this canister's own account, which escrow knows them by, unless they
    // are paying from an external account they approved
    let payer = match args.from_account {
        Some(from) => Payer::Approved {
            from,
            spender_subaccount: None,
        },
        None => Payer::ThisCanister,
    };
    match deposit_to_accept_p2p_swap(
        escrow_canister_id,
        my_canister_id,
        args.swap_id,
        &args.token1,
        args.token1_amount,
        now,
        payer,
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
    my_canister_id: CanisterId,
    escrow_canister_id: CanisterId,
    now: TimestampMillis,
}

fn prepare_impl(args: &mut Args, state: &mut RuntimeState) -> OCResult<PrepareResult> {
    let now = state.env.now();
    let my_canister_id = state.env.canister_id();
    prepare(&mut state.data.user, my_canister_id, args, now)?;
    // Recorded before the deposit is made, since the swap can then only be settled by the Escrow
    state.data.record_p2p_swap(args.expires_at);

    Ok(PrepareResult {
        my_canister_id,
        escrow_canister_id: state.data.escrow_canister_id,
        now,
    })
}
