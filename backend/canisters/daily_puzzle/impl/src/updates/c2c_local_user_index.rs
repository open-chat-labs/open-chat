use crate::guards::verify_caller_is_local_user_index;
use crate::{RuntimeState, mutate_state, read_state};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use daily_puzzle_canister::LocalUserIndexEvent;
use daily_puzzle_canister::c2c_local_user_index::*;
use types::{IdempotentEnvelope, UnitResult};

#[update(msgpack = true)]
#[trace]
async fn c2c_local_user_index(args: Args) -> Response {
    let caller = read_state(|state| state.env.caller());
    if let Err(error) = verify_caller_is_local_user_index(caller).await {
        return UnitResult::Error(error);
    }
    mutate_state(|state| apply(caller, args.events, state));
    UnitResult::Success
}

fn apply(caller: Principal, events: Vec<IdempotentEnvelope<LocalUserIndexEvent>>, state: &mut RuntimeState) {
    let now = state.env.now();
    let results = events
        .into_iter()
        .filter(|event| {
            state
                .data
                .idempotency_checker
                .check(caller, event.created_at, event.idempotency_id)
        })
        .map(|event| match event.value {
            LocalUserIndexEvent::ReportResult(result) => result,
        })
        .collect();
    state.data.upsert_results(results, now);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Data;
    use types::{DailyPuzzleResult, LIGHT_UP_GAME_ID, UserId};
    use utils::env::test::TestEnv;

    // An event older than the latest already had from the same sender is one it has sent before,
    // and is dropped; a newer one is applied
    #[test]
    fn events_older_than_the_latest_from_the_sender_are_dropped() {
        let env = TestEnv::default();
        let now = env.now;
        let data = Data::new(Principal::anonymous(), Principal::anonymous(), Principal::anonymous(), true);
        let mut state = RuntimeState::new(Box::new(env), data);
        let caller = Principal::from_slice(&[1]);
        let result = |user: u8| DailyPuzzleResult {
            game_id: LIGHT_UP_GAME_ID.to_string(),
            number: Data::number_for(now),
            user_id: UserId::from(Principal::from_slice(&[user])),
            solve_time_ms: 1,
            hints_used: 0,
            streak: 1,
            solved_at: now,
        };
        let event = |created_at, user| IdempotentEnvelope {
            created_at,
            idempotency_id: user as u64,
            value: LocalUserIndexEvent::ReportResult(result(user)),
        };

        apply(caller, vec![event(now, 1)], &mut state);
        apply(caller, vec![event(now - 1, 2), event(now + 1, 3)], &mut state);

        let reported: Vec<_> = state.data.results.values().map(|r| r.user_id).collect();
        assert_eq!(reported, vec![result(1).user_id, result(3).user_id]);
    }
}
