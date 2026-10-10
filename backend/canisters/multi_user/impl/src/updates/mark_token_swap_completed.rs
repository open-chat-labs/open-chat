use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{Achievement, OCResult, Timestamped};
use user_canister::mark_token_swap_completed::*;
use user_core::SwapSuccess;

// Records how a swap the user made from their own wallet ended (see `mark_token_swap_started`). A
// swap which has already been marked as completed is left as it is.
#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn mark_token_swap_completed(args: Args) -> Response {
    execute_update(|state| mark_token_swap_completed_impl(args, state)).into()
}

fn mark_token_swap_completed_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let now = state.env.now();
    let (user_index, swapped) = state.with_caller_user_mut(|user_index, user| {
        let Some(mut token_swap) = user.token_swaps.get(args.swap_id).filter(|s| s.made_by_user) else {
            return Err(OCErrorCode::SwapNotFound);
        };
        if token_swap.success.is_some() {
            return Ok((user_index, false));
        }
        let swapped = args.result.is_ok();
        match args.result {
            Ok(amount_out) => {
                // The DEX pays the output to the wallet itself
                token_swap.swap_result = Some(Timestamped::new(
                    Ok(Ok(SwapSuccess {
                        amount_out,
                        withdrawal_success: Some(true),
                    })),
                    now,
                ));
                token_swap.withdrawn_from_dex_at = Some(Timestamped::new(Ok(amount_out), now));
            }
            Err(error) => token_swap.swap_result = Some(Timestamped::new(Ok(Err(error)), now)),
        }
        token_swap.success = Some(Timestamped::new(swapped, now));
        user.token_swaps.upsert(token_swap);
        Ok((user_index, swapped))
    })?;

    if swapped {
        state.award_achievement_and_notify(user_index, Achievement::SwappedFromWallet, now);
    }
    Ok(())
}
