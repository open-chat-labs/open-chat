use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::model::chit_leaderboard::ChitUserBalance;
use crate::{mutate_state, Data, RuntimeState};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use std::collections::BinaryHeap;
use tracing::info;
use user_index_canister::post_upgrade::Args;
use utils::cycles::init_cycles_dispenser_client;
use utils::time::MonthKey;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    let env = init_env(data.rng_seed, data.oc_key_pair.is_initialised());
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    // TODO: Remove after release
    mutate_state(initialize_leaderboards);

    info!(version = %args.wasm_version, "Post-upgrade complete");
}

fn initialize_leaderboards(state: &mut RuntimeState) {
    let now = state.env.now();
    let this_month_key = MonthKey::from_timestamp(now);
    let last_month_key = this_month_key.previous();

    let mut all_time = BinaryHeap::new();
    let mut this_month = BinaryHeap::new();
    let mut last_month = BinaryHeap::new();

    for user in state.data.users.iter() {
        let total = user.total_chit_earned();

        if total > 50_000 {
            all_time.push(ChitUserBalance {
                balance: total as u32,
                user_id: user.user_id,
            });

            this_month.push(ChitUserBalance {
                balance: user.current_chit_balance(now) as u32,
                user_id: user.user_id,
            });

            last_month.push(ChitUserBalance {
                balance: user.chit_per_month.get(&last_month_key).copied().unwrap_or_default() as u32,
                user_id: user.user_id,
            });
        }
    }

    state
        .data
        .chit_leaderboard
        .initialize(pop10(&mut all_time), pop10(&mut this_month), pop10(&mut last_month), now);
}

fn pop10<T: Ord>(heap: &mut BinaryHeap<T>) -> Vec<T> {
    let mut result = Vec::new();

    for _i in 0..10 {
        if let Some(v) = heap.pop() {
            result.push(v);
        } else {
            break;
        }
    }

    result
}
