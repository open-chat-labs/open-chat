use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, Data, RuntimeState};
use candid::Principal;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use local_user_index_canister::{ChitEarned, Event};
use stable_memory::get_reader;
use tracing::info;
use types::{ChitEarnedReason, UserId};
use user_index_canister::post_upgrade::Args;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    let env = init_env(data.rng_seed, data.oc_key_pair.is_initialised());
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    // TODO: Remove this - one time code to give CHIT to meme contest winners
    mutate_state(|state| {
        if !state.data.test_mode && state.data.chit_leaderboard.get().is_empty() {
            give_chit_reward(state, "ab4g5-3qaaa-aaaar-aidhq-cai", 10000);
            give_chit_reward(state, "27uaj-6iaaa-aaaar-au4cq-cai", 7000);
            give_chit_reward(state, "pyd4k-raaaa-aaaar-arbza-cai", 5000);
        }
    });
}

fn give_chit_reward(state: &mut RuntimeState, user_id: &str, amount: i32) {
    let now = state.env.now();
    let user_id = UserId::from(Principal::from_text(user_id).unwrap());

    state.data.users.give_chit_reward(&user_id, amount, now);

    state.data.chit_leaderboard.update_position(user_id, amount);

    state.push_event_to_local_user_index(
        user_id,
        Event::ChitEarned(ChitEarned {
            user_id,
            amount,
            timestamp: now,
            reason: ChitEarnedReason::MemeContestWinner,
        }),
    );
}
