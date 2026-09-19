use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::{OCError, OCErrorCode};
use types::{ChitEvent, ChitEventType};
use user_canister::c2c_game_chit::{Response::*, *};
use user_state::validate_game_chit_args;

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_game_chit(args: Args) -> Response {
    mutate_state(|state| c2c_game_chit_impl(args, state))
}

fn c2c_game_chit_impl(args: Args, state: &mut RuntimeState) -> Response {
    let Some(user_index) = state.local_user_index(args.user_id) else {
        return Error(OCErrorCode::TargetUserNotFound.into());
    };

    let now = state.env.now();
    let result = state
        .data
        .users
        .with_user_mut(user_index, |user| -> Result<SuccessResult, OCError> {
            user.verify_not_suspended()?;

            validate_game_chit_args(&args).map_err(|message| OCErrorCode::InvalidRequest.with_message(message))?;

            // Checked before the balance so that a repeated key always returns AlreadyAdded, even if
            // the balance has since dropped
            if user.game_chit_keys.contains(&args.game_id, &args.key) {
                return Err(OCErrorCode::AlreadyAdded.into());
            }

            let chit_balance = user.chit_events.chit_balance();
            if args.amount < 0 && chit_balance < -args.amount {
                // The key is deliberately not recorded here, so the debit can be retried once affordable
                return Err(OCErrorCode::InsufficientFunds.with_message(chit_balance));
            }

            user.game_chit_keys.insert(&args.game_id, &args.key, now);
            user.chit_events.push(ChitEvent {
                timestamp: now,
                amount: args.amount,
                reason: ChitEventType::Game {
                    game_id: args.game_id,
                    key: args.key,
                },
            });

            Ok(SuccessResult {
                chit_balance: user.chit_events.chit_balance(),
                total_chit_earned: user.chit_events.total_chit_earned(),
            })
        })
        .expect("User not found");

    match result {
        Ok(result) => {
            state.notify_user_index_of_chit(user_index, now);
            Success(result)
        }
        Err(error) => Error(error),
    }
}
