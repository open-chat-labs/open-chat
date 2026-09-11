use crate::guards::caller_is_openchat_user;
use crate::model::daily_puzzle_engine::StartPrepared;
use crate::model::game_chit_credit::{GameChitCredit, GameChitOutcome, apply};
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::daily_puzzle_start::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::{OCResult, UserId};

#[update(guard = "caller_is_openchat_user", msgpack = true)]
#[trace]
async fn daily_puzzle_start(args: Args) -> Response {
    // The record is created here, before the debit, so the clock runs from this call and a failed
    // debit is the only thing that can undo it
    let PrepareResult {
        user_id,
        fee,
        key,
        mut result,
    } = match mutate_state(|state| prepare(&args, state)) {
        Ok(Prepared::AlreadyStarted(result)) => return Success(result),
        Ok(Prepared::Start(prepared)) => prepared,
        Err(error) => return Error(error),
    };

    if fee > 0 {
        let Ok(amount) = i32::try_from(fee) else {
            return Error(OCErrorCode::InvalidRequest.with_message("fee"));
        };
        let debit = GameChitCredit {
            user_id,
            game_id: args.game_id.clone(),
            key,
            amount: -amount,
        };
        let outcome = apply(&debit).await;
        // `AlreadyAdded` lands in `Applied` too: a previous start paid but failed to record. The
        // key does not identify the puzzle, so a regenerated day is a free restart rather than a
        // second charge.
        let error = match outcome {
            GameChitOutcome::Applied(balances) => {
                if let Some(balances) = balances {
                    result.chit_balance = Some(balances.chit_balance);
                    result.total_chit_earned = Some(balances.total_chit_earned);
                }
                None
            }
            GameChitOutcome::Refused(error) => Some(error),
            GameChitOutcome::Failed(error) => Some(error.into()),
        };

        return mutate_state(|state| {
            let engine = &mut state.data.daily_puzzle_engine;
            match error {
                Some(error) => {
                    engine.release_start(user_id, &args.game_id, args.number);
                    Error(error)
                }
                None => {
                    engine.confirm_start(user_id, &args.game_id, args.number);
                    Success(result)
                }
            }
        });
    }

    Success(result)
}

enum Prepared {
    AlreadyStarted(StartResult),
    Start(PrepareResult),
}

struct PrepareResult {
    user_id: UserId,
    fee: u32,
    key: String,
    result: StartResult,
}

fn prepare(args: &Args, state: &mut RuntimeState) -> OCResult<Prepared> {
    let user_id = state.calling_user_id();
    if !state.data.local_users.contains(&user_id) {
        return Err(OCErrorCode::InitiatorNotFound.into());
    }
    if state.data.global_users.is_bot(&user_id) {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let now = state.env.now();
    match state
        .data
        .daily_puzzle_engine
        .reserve_start(user_id, &args.game_id, args.number, args.expected_entry_fee, now)?
    {
        StartPrepared::AlreadyStarted(result) => Ok(Prepared::AlreadyStarted(result)),
        StartPrepared::Start { fee, key, result } => Ok(Prepared::Start(PrepareResult {
            user_id,
            fee,
            key,
            result,
        })),
    }
}
