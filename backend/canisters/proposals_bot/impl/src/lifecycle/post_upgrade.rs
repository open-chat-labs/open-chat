use crate::lifecycle::{init_env, init_state, UPGRADE_BUFFER_SIZE};
use crate::memory::get_upgrades_memory;
use crate::{mutate_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use ic_stable_structures::reader::{BufferedReader, Reader};
use proposals_bot_canister::post_upgrade::Args;
use std::time::Duration;
use tracing::info;
use types::CanisterId;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let env = init_env();

    let memory = get_upgrades_memory();
    let reader = BufferedReader::new(UPGRADE_BUFFER_SIZE, Reader::new(&memory, 0));

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    init_cycles_dispenser_client(data.cycles_dispenser_canister_id);
    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    // TODO Remove this after next upgrade
    ic_cdk_timers::set_timer(Duration::ZERO, enable_submitting_oc_proposals);
}

fn enable_submitting_oc_proposals() {
    mutate_state(|state| {
        state.data.fire_and_forget_handler.send(
            state.data.registry_canister_id,
            "c2c_set_submitting_proposals_enabled_msgpack".to_string(),
            msgpack::serialize_then_unwrap(registry_canister::c2c_set_submitting_proposals_enabled::Args {
                governance_canister_id: CanisterId::from_text("2jvtu-yqaaa-aaaaq-aaama-cai").unwrap(),
                enabled: true,
            }),
        );
    });
}
