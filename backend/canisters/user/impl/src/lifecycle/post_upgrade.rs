use crate::lifecycle::{init_env, init_state};
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use crate::{Data, RuntimeState, mutate_state, openchat_bot};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use rand::RngCore;
use stable_memory::get_reader;
use std::collections::BTreeSet;
use std::time::Duration;
use tracing::info;
use types::{ChitEarned, ChitEarnedReason, IdempotentEnvelope};
use user_canister::post_upgrade::Args;
use utils::env::Environment;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init(get_stable_memory_map_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    data.user_canister_events_queue.set_defer_processing(true);
    data.local_user_index_event_sync_queue.set_defer_processing(true);

    let mut env = init_env(data.rng_seed);
    let now = env.now();
    #[expect(deprecated)]
    let events = data.event_store_client.take_events();
    data.local_user_index_event_sync_queue.push_many(
        events
            .into_iter()
            .map(|event| IdempotentEnvelope {
                created_at: now,
                idempotency_id: env.rng().next_u64(),
                value: local_user_index_canister::UserEvent::EventStoreEvent(event.into()),
            })
            .collect(),
    );

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    init_state(env, data, args.wasm_version);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");

    mutate_state(|state| reinstate_daily_claims(state, 1));
}

fn reinstate_daily_claims(state: &mut RuntimeState, max_days_to_reinstate: u16) {
    let now = state.env.now();
    let now_day = state.data.streak.timestamp_to_day(now).unwrap();
    let current_end_day = state.data.streak.end_day();
    if current_end_day < now_day.saturating_sub(3) {
        return;
    }

    let chit_claim_days: BTreeSet<_> = state
        .data
        .chit_events
        .iter_daily_claims()
        .flat_map(|ts| state.data.streak.timestamp_to_day(ts))
        .collect();

    let (days_to_reinstate, new_start_day) =
        streak_days_to_reinstate(&chit_claim_days, now_day, max_days_to_reinstate as usize);

    if !days_to_reinstate.is_empty() {
        let count = days_to_reinstate.len();
        for day in days_to_reinstate {
            // Take the last millisecond of the day
            let timestamp = state.data.streak.day_to_timestamp(day + 1) - 1;
            state.data.chit_events.push(ChitEarned {
                timestamp,
                reason: ChitEarnedReason::DailyClaimReinstated,
                amount: 0,
            });
        }
        assert_eq!(state.data.streak.start_day() - new_start_day, count as u16);
        state.data.streak.set_start_day(new_start_day);
        let new_streak = state.data.streak.days(now);

        let first_line = if count == 1 {
            "1 missed daily claim has been reinstated."
        } else {
            "2 missed daily claims have been reinstated."
        };
        let message = format!(
            "{first_line}
Your new streak length is now {new_streak}!

Going forward, daily claims will operate in your local timezone rather than UTC."
        );

        ic_cdk_timers::set_timer(Duration::ZERO, || {
            mutate_state(|state| {
                openchat_bot::send_text_message(message, Vec::new(), false, state);
                state.notify_user_index_of_chit(state.env.now());
            });
        });
    }
}

fn streak_days_to_reinstate(chit_claim_days: &BTreeSet<u16>, now_day: u16, max_days_to_reinstate: usize) -> (Vec<u16>, u16) {
    let mut to_add = Vec::new();
    let mut new_start_day = now_day;
    for next in (0..now_day).rev() {
        if chit_claim_days.contains(&next) {
            new_start_day = next;
            continue;
        }
        if to_add.len() < max_days_to_reinstate {
            to_add.push(next);

            if to_add.len() >= max_days_to_reinstate {
                break;
            }
        }
    }

    // Only keep days which plug gaps between existing claims
    to_add.retain(|d| *d > new_start_day);
    (to_add, new_start_day)
}

#[cfg(test)]
mod tests {
    use super::*;
    use test_case::test_case;

    #[test_case(vec![1, 2, 3, 6, 8, 9], 10, vec![7], 6)]
    #[test_case(vec![1, 2, 3, 4, 6, 8, 9], 10, vec![7, 5], 1)]
    #[test_case(vec![], 10, vec![], 10)]
    #[test_case(vec![6, 9], 10, vec![8, 7], 6)]
    #[test_case(vec![5, 8], 10, vec![9], 8)]
    #[test_case(vec![4, 6, 7, 8], 10, vec![9, 5], 4)]
    fn streak_days_to_reinstate_tests(
        chit_claim_days: Vec<u16>,
        now_day: u16,
        expected_days_to_add: Vec<u16>,
        expected_start_day: u16,
    ) {
        let (to_add, start_day) = streak_days_to_reinstate(&chit_claim_days.into_iter().collect(), now_day, 1);
        assert_eq!(to_add, expected_days_to_add);
        assert_eq!(start_day, expected_start_day);
    }
}
