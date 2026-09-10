use crate::guards::caller_is_openchat_user;
use crate::model::daily_puzzle_engine::HintPrepared;
use crate::model::game_chit_credit::{GameChitCredit, GameChitOutcome, apply};
use crate::{RuntimeState, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::daily_puzzle_hint::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::{OCResult, UserId};

#[update(guard = "caller_is_openchat_user", msgpack = true)]
#[trace]
async fn daily_puzzle_hint(args: Args) -> Response {
    let (user_id, step, hint, level, price, key) = match read_state(|state| prepare(&args, state)) {
        Ok((_, HintPrepared::Mistake(result))) | Ok((_, HintPrepared::AlreadyServed(result))) => return Success(result),
        Ok((
            user_id,
            HintPrepared::Serve {
                step,
                hint,
                level,
                price,
                key,
            },
        )) => (user_id, step, hint, level, price, key),
        Err(error) => return Error(error),
    };

    let mut balances = None;
    if price > 0 {
        let Ok(amount) = i32::try_from(price) else {
            return Error(OCErrorCode::InvalidRequest.with_message("price"));
        };
        let debit = GameChitCredit {
            user_id,
            game_id: args.game_id.clone(),
            key,
            amount: -amount,
        };
        match apply(&debit).await {
            GameChitOutcome::Applied(result) => balances = result,
            GameChitOutcome::Refused(error) => return Error(error),
            GameChitOutcome::Failed(error) => return Error(error.into()),
        }
    }

    mutate_state(|state| {
        match state
            .data
            .daily_puzzle_engine
            .commit_hint(user_id, &args.game_id, args.number, step, hint, level)
        {
            Ok(mut result) => {
                if let Some(balances) = balances {
                    result.chit_balance = Some(balances.chit_balance);
                    result.total_chit_earned = Some(balances.total_chit_earned);
                }
                Success(result)
            }
            Err(error) => Error(error),
        }
    })
}

fn prepare(args: &Args, state: &RuntimeState) -> OCResult<(UserId, HintPrepared)> {
    let user_id = state.calling_user_id();
    let now = state.env.now();
    let prepared = state.data.daily_puzzle_engine.prepare_hint(
        user_id,
        &args.game_id,
        args.number,
        args.level,
        &args.filled,
        args.expected_price,
        now,
    )?;
    Ok((user_id, prepared))
}
