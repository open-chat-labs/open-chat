use crate::guards::caller_is_openchat_user;
use crate::model::daily_puzzle_engine::StartPrepared;
use crate::model::game_chit_credit::{GameChitCredit, GameChitOutcome, apply};
use crate::{RuntimeState, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::daily_puzzle_start::{Response::*, *};
use oc_error_codes::OCErrorCode;
use types::{OCResult, TimestampMillis, UserId};

#[update(guard = "caller_is_openchat_user", msgpack = true)]
#[trace]
async fn daily_puzzle_start(args: Args) -> Response {
    let PrepareResult {
        user_id,
        fee,
        key,
        started_at,
    } = match read_state(|state| prepare(&args, state)) {
        Ok(Prepared::AlreadyStarted(result)) => return Success(result),
        Ok(Prepared::Start(prepared)) => prepared,
        Err(error) => return Error(error),
    };

    let mut entry_paid = false;
    let mut balances = None;
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
        match apply(&debit).await {
            // `AlreadyAdded` lands here too: a previous start paid but failed to commit
            GameChitOutcome::Applied(result) => {
                entry_paid = true;
                balances = result;
            }
            GameChitOutcome::Refused(error) => return Error(error),
            GameChitOutcome::Failed(error) => return Error(error.into()),
        }
    }

    mutate_state(|state| {
        match state
            .data
            .daily_puzzle_engine
            .commit_start(user_id, &args.game_id, args.number, started_at, entry_paid)
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

enum Prepared {
    AlreadyStarted(StartResult),
    Start(PrepareResult),
}

struct PrepareResult {
    user_id: UserId,
    fee: u32,
    key: String,
    // Captured before the debit so the await does not eat into the solve time
    started_at: TimestampMillis,
}

fn prepare(args: &Args, state: &RuntimeState) -> OCResult<Prepared> {
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
        .prepare_start(user_id, &args.game_id, args.number, args.expected_entry_fee, now)?
    {
        StartPrepared::AlreadyStarted(result) => Ok(Prepared::AlreadyStarted(result)),
        StartPrepared::Start { fee } => Ok(Prepared::Start(PrepareResult {
            user_id,
            fee,
            key: state.data.daily_puzzle_engine.entry_key(&args.game_id, args.number),
            started_at: now,
        })),
    }
}
