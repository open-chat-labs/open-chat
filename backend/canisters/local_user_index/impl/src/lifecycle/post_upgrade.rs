use crate::Data;
use crate::lifecycle::{init_env, init_state};
use crate::memory::{get_stable_memory_map_memory, get_upgrades_memory};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk::post_upgrade;
use local_user_index_canister::ChildCanisterType;
use local_user_index_canister::post_upgrade::Args;
use stable_memory::get_reader;
use tracing::info;
use utils::cycles::init_cycles_dispenser_client;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init(get_stable_memory_map_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    // One-off: there are no User canisters left, so their wasm is no longer needed
    #[expect(deprecated)]
    let user_wasm_removed = data.child_canister_wasms.remove(ChildCanisterType::User);

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    // One-off: the bots' owners and the direct chats they may only be installed in may still be named
    // by the ids users had before being migrated to a MultiUser canister
    // TODO remove after the release containing this has been deployed
    let (bot_owners_replaced, bot_locations_replaced) = data.bots.replace_old_user_ids(&data.migrated_user_ids);
    info!(
        bot_owners_replaced,
        bot_locations_replaced, "Replaced old user ids in the bots with their latest"
    );

    let env = init_env(data.rng_seed);
    init_cycles_dispenser_client(data.cycles_dispenser_canister_id, data.test_mode);
    init_state(env, data, args.wasm_version);

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, user_wasm_removed, "Post-upgrade complete");
}
