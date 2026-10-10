use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::{MAX_TOKEN_SWAPS, MAX_TOKEN_SYMBOL_LENGTH};
use oc_error_codes::OCErrorCode;
use types::OCResult;
use user_canister::mark_token_swap_started::*;
use user_canister::swap_tokens::ExchangeArgs;
use user_core::TokenSwap;

// The users of this canister hold their own funds, so make their swaps themselves, straight from
// their wallets, rather than through `swap_tokens`. This records each swap as it starts, so that one
// which doesn't finish can be found again (see `unfinished_token_swaps`) and any funds left with the
// DEX withdrawn. It checks the user's PIN, as `swap_tokens` does, before anything is approved.
#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn mark_token_swap_started(args: Args) -> Response {
    execute_update(|state| mark_token_swap_started_impl(args, state)).into()
}

fn mark_token_swap_started_impl(mut args: Args, state: &mut RuntimeState) -> OCResult {
    if !matches!(args.exchange_args, ExchangeArgs::ICPSwap(_) | ExchangeArgs::Taco(_)) {
        return Err(OCErrorCode::InvalidRequest.with_message("Unsupported exchange"));
    }
    if [&args.input_token, &args.output_token]
        .iter()
        .any(|t| t.symbol.len() > MAX_TOKEN_SYMBOL_LENGTH)
    {
        return Err(OCErrorCode::InvalidRequest.with_message("Token symbol too long"));
    }
    let now = state.env.now();
    state.with_caller_user_mut(|_, user| {
        user.verify_not_suspended()?;
        user.pin_number.verify(args.pin.as_mut(), now)?;
        if user.token_swaps.get(args.swap_id).is_some() {
            return Err(OCErrorCode::AlreadyAdded.into());
        }
        if user.token_swaps.len() >= MAX_TOKEN_SWAPS {
            return Err(OCErrorCode::LimitReached.with_message(MAX_TOKEN_SWAPS));
        }
        let mut token_swap = TokenSwap::new(
            user_canister::swap_tokens::Args {
                swap_id: args.swap_id,
                input_token: args.input_token,
                output_token: args.output_token,
                input_amount: args.input_amount,
                exchange_args: args.exchange_args,
                min_output_amount: args.min_output_amount,
                from_account: None,
                pin: None,
            },
            // The DEX pulls the input from the wallet via ICRC-2 and pays the output back to it
            true,
            true,
            now,
        );
        token_swap.made_by_user = true;
        user.token_swaps.upsert(token_swap);
        Ok(())
    })
}
