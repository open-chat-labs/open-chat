use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{ChitEvent, ChitEventType};
use user_canister::c2c_game_chit::{Response::*, *};

const MAX_ABS_AMOUNT: i32 = 100_000;
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

    if args.amount == 0 || args.amount.abs() > MAX_ABS_AMOUNT {
        return Error(OCErrorCode::InvalidRequest.with_message("Invalid amount"));
    }

    if args.game_id.is_empty() || args.game_id.len() > MAX_ID_LENGTH || args.key.is_empty() || args.key.len() > MAX_ID_LENGTH {
        return Error(OCErrorCode::InvalidRequest.with_message("Invalid game_id or key"));
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
