use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::MAX_GAME_CHIT_ABS_AMOUNT;
use oc_error_codes::OCErrorCode;
use types::{ChitEvent, ChitEventType};
use user_canister::c2c_game_chit::{Response::*, *};

const MAX_ID_LENGTH: usize = 64;

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_game_chit(args: Args) -> Response {
    execute_update(|state| c2c_game_chit_impl(args, state))
}

fn c2c_game_chit_impl(args: Args, state: &mut RuntimeState) -> Response {
    if let Err(error) = state.data.verify_not_suspended() {
        return Error(error.into());
    }

    if let Err(message) = validate_args(&args) {
        return Error(OCErrorCode::InvalidRequest.with_message(message));
    }

    // Checked before the balance so that a repeated key always returns AlreadyAdded, even if the
    // balance has since dropped.
    if state.data.game_chit_keys.contains(&args.game_id, &args.key) {
        return Error(OCErrorCode::AlreadyAdded.into());
    }

    let chit_balance = state.data.chit_events.chit_balance();
    if args.amount < 0 && chit_balance < -args.amount {
        // The key is deliberately not recorded here, so the debit can be retried once affordable
        return Error(OCErrorCode::InsufficientFunds.with_message(chit_balance));
    }

    let now = state.env.now();
    state.data.game_chit_keys.insert(&args.game_id, &args.key, now);

    state.data.chit_events.push(ChitEvent {
        timestamp: now,
        amount: args.amount,
        reason: ChitEventType::Game {
            game_id: args.game_id,
            key: args.key,
        },
    });

    state.notify_user_index_of_chit(now);

    Success(SuccessResult {
        chit_balance: state.data.chit_events.chit_balance(),
        total_chit_earned: state.data.chit_events.total_chit_earned(),
    })
}

fn validate_args(args: &Args) -> Result<(), &'static str> {
    // Not `abs()`, which wraps for `i32::MIN` and would let that one value through
    if args.amount == 0 || args.amount < -MAX_GAME_CHIT_ABS_AMOUNT || args.amount > MAX_GAME_CHIT_ABS_AMOUNT {
        return Err("Invalid amount");
    }
    if args.game_id.is_empty() || args.game_id.len() > MAX_ID_LENGTH || args.key.is_empty() || args.key.len() > MAX_ID_LENGTH {
        return Err("Invalid game_id or key");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    fn args(game_id: &str, key: &str, amount: i32) -> Args {
        Args {
            user_id: Principal::anonymous().into(),
            game_id: game_id.to_string(),
            key: key.to_string(),
            amount,
        }
    }

    // #9332 invariant 14. The amount is bounded by range, not `abs()`, so `i32::MIN` is refused
    // like any other value outside the limit rather than wrapping past both the limit and the
    // balance check.
    #[test]
    fn amount_and_ids_are_bounded() {
        for amount in [1, -1, MAX_GAME_CHIT_ABS_AMOUNT, -MAX_GAME_CHIT_ABS_AMOUNT] {
            assert!(validate_args(&args("light_up", "1:solve", amount)).is_ok(), "{amount}");
        }
        for amount in [
            0,
            MAX_GAME_CHIT_ABS_AMOUNT + 1,
            -MAX_GAME_CHIT_ABS_AMOUNT - 1,
            i32::MAX,
            i32::MIN,
        ] {
            assert_eq!(
                validate_args(&args("light_up", "1:solve", amount)),
                Err("Invalid amount"),
                "{amount}"
            );
        }
        let long = "g".repeat(MAX_ID_LENGTH + 1);
        let max = "g".repeat(MAX_ID_LENGTH);
        assert!(validate_args(&args(&max, &max, 10)).is_ok());
        for (game_id, key) in [
            ("", "1:solve"),
            ("light_up", ""),
            (long.as_str(), "1:solve"),
            ("light_up", long.as_str()),
        ] {
            assert_eq!(
                validate_args(&args(game_id, key, 10)),
                Err("Invalid game_id or key"),
                "{game_id:?} {key:?}"
            );
        }
    }
}
