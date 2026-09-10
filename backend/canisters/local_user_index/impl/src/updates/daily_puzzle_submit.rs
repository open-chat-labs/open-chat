use crate::guards::caller_is_openchat_user;
use crate::model::daily_puzzle_engine::SubmitOutcome;
use crate::model::game_chit_credit::{GameChitCredit, GameChitOutcome, apply};
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::daily_puzzle_submit::{Response::*, *};
use tracing::error;
use types::OCResult;
use utils::canister::delay_if_should_retry_failed_c2c_call;

#[update(guard = "caller_is_openchat_user", msgpack = true)]
#[trace]
async fn daily_puzzle_submit(args: Args) -> Response {
    // The solve record and the results row are committed here, before any await
    let (mut outcome, credit) = match mutate_state(|state| submit(&args, state)) {
        Ok(result) => result,
        Err(error) => return Error(error),
    };

    if let Some(credit) = credit {
        match apply(&credit).await {
            // The response carries the balances only when the credit landed in this call, so
            // the client can set its CHIT stores from them instead of guessing a delta
            GameChitOutcome::Applied(Some(result)) => {
                outcome.solved.chit_balance = Some(result.chit_balance);
                outcome.solved.total_chit_earned = Some(result.total_chit_earned);
            }
            GameChitOutcome::Applied(None) => {}
            GameChitOutcome::Refused(error) => {
                error!(?error, key = %credit.key, "Daily puzzle reward refused by user canister");
            }
            GameChitOutcome::Failed(error) => {
                if delay_if_should_retry_failed_c2c_call(&error).is_some() {
                    mutate_state(|state| state.data.game_chit_credit_retry_queue.push(credit));
                } else {
                    error!(?error, key = %credit.key, "Daily puzzle reward credit failed");
                }
            }
        }
    }

    Success(outcome.solved)
}

fn submit(args: &Args, state: &mut RuntimeState) -> OCResult<(SubmitOutcome, Option<GameChitCredit>)> {
    let user_id = state.calling_user_id();
    let now = state.env.now();

    let outcome = state
        .data
        .daily_puzzle_engine
        .submit(user_id, &args.game_id, args.number, &args.grid, now)?;

    state.push_daily_puzzle_result(outcome.result.clone());

    let credit = i32::try_from(outcome.solved.reward)
        .ok()
        .filter(|amount| *amount > 0)
        .map(|amount| GameChitCredit {
            user_id,
            game_id: args.game_id.clone(),
            key: state.data.daily_puzzle_engine.solve_key(&args.game_id, args.number),
            amount,
        });

    Ok((outcome, credit))
}
