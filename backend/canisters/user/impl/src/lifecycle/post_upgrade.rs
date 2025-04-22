use crate::Data;
use crate::lifecycle::{init_env, init_state};
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use notifications_canister_c2c_client::NotificationPusherState;
use stable_memory::get_reader;
use tracing::info;
use types::{ChitEarned, ChitEarnedReason};
use user_canister::post_upgrade::Args;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init(get_stable_memory_map_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    for timestamp in data.streak.fix_streak_claim_timestamps() {
        data.chit_events.push(ChitEarned {
            amount: 0,
            timestamp,
            reason: ChitEarnedReason::StreakInsuranceClaim,
        })
    }

    data.notifications_queue.set_state(NotificationPusherState {
        notifications_canister: data.notifications_canister_id,
        authorizer: data.local_user_index_canister_id,
    });

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed);
    init_state(env, data, args.wasm_version);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");
}
