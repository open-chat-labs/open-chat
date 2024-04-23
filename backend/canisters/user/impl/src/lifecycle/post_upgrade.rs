use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;
use types::{Empty, Milliseconds};
use user_canister::post_upgrade::Args;
use utils::time::DAY_IN_MS;

const SIX_MONTHS: Milliseconds = 183 * DAY_IN_MS;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    let env = init_env(data.rng_seed);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    mutate_state(|state| {
        if state.data.user_created + SIX_MONTHS < state.env.now()
            && state.data.direct_chats.len() <= 1
            && state.data.group_chats.len() == 0
            && state.data.communities.len() == 0
        {
            ic_cdk_timers::set_timer(Duration::ZERO, mark_user_canister_empty);
        }
    });
}

fn mark_user_canister_empty() {
    mutate_state(|state| {
        let user_index_canister_id = state.data.user_index_canister_id;
        state.data.fire_and_forget_handler.send(
            user_index_canister_id,
            "c2c_mark_user_canister_empty_msgpack",
            msgpack::serialize_then_unwrap(Empty {}),
        );
    })
}
