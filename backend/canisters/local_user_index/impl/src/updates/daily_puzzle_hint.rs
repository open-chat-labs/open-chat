use crate::guards::caller_is_openchat_user;
use crate::model::daily_puzzle_engine::HintPrepared;
use crate::model::game_chit_credit::{GameChitCredit, GameChitOutcome, apply};
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::daily_puzzle_hint::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::{OCResult, UserId};

#[update(guard = "caller_is_openchat_user", msgpack = true)]
#[trace]
async fn daily_puzzle_hint(args: Args) -> Response {
    // The step is recorded here, before the debit, so calls that overlap on the await cannot get
    // more steps than `max_hints` between them
    let (user_id, step, mut result, price, key, restore) = match mutate_state(|state| prepare(&args, state)) {
        Ok((_, HintPrepared::Mistake(result))) | Ok((_, HintPrepared::AlreadyServed(result))) => return Success(result),
        Ok((
            user_id,
            HintPrepared::Serve {
                step,
                result,
                price,
                key,
                restore,
            },
        )) => (user_id, step, result, price, key, restore),
        Err(error) => return Error(error),
    };

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
        let error = match apply(&debit).await {
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

        if let Some(error) = error {
            return mutate_state(|state| {
                state
                    .data
                    .daily_puzzle_engine
                    .release_hint(user_id, &args.game_id, args.number, step, restore);
                Error(error)
            });
        }
    }

    Success(result)
}

type Prepared = (UserId, HintPrepared);

fn prepare(args: &Args, state: &mut RuntimeState) -> OCResult<Prepared> {
    let user_id = state.calling_user_id();
    let now = state.env.now();
    let prepared = state.data.daily_puzzle_engine.reserve_hint(
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
