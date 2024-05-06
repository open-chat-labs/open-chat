use crate::lifecycle::{init_env, init_state};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use stable_memory::get_reader;
use std::time::Duration;
use tracing::info;
use types::{CanisterId, Empty, Milliseconds};
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

    let deleted_canisters: Vec<_> = [
        "sch6m-vaaaa-aaaaf-ageyq-cai",
        "st47y-kiaaa-aaaaf-a2zkq-cai",
        "k26wp-yiaaa-aaaaf-beaua-cai",
        "antsy-qaaaa-aaaar-a35fq-cai",
        "vmdca-pqaaa-aaaaf-aabzq-cai",
        "a6ew7-jyaaa-aaaaf-adsaq-cai",
        "t2zs6-tiaaa-aaaaf-aak5q-cai",
    ]
    .into_iter()
    .map(|str| CanisterId::from_text(str).unwrap())
    .collect();

    mutate_state(|state| {
        let now = state.env.now();
        for canister_id in deleted_canisters {
            state.data.group_chats.remove(canister_id.into(), now);
            state.data.communities.remove(canister_id.into(), now);
        }

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
