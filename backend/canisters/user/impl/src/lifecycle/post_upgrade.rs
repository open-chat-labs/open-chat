use crate::lifecycle::{init_env, init_state};
use crate::memory::{get_chat_events_memory, get_upgrades_memory};
use crate::Data;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use stable_memory::get_reader;
use tracing::info;
use user_canister::post_upgrade::Args;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    chat_events::ChatEvents::init_stable_storage(get_chat_events_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = msgpack::deserialize(reader).unwrap();
    for chat in data.direct_chats.iter_mut() {
        chat.events.set_stable_memory_key_prefixes();
    }

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    let env = init_env(data.rng_seed);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");
}
