use crate::jobs::import_groups::finalize_group_import;
use crate::lifecycle::init_state;
use crate::memory::{get_stable_memory_map_memory, get_stable_memory_map_small_entries_memory, get_upgrades_memory};
use crate::updates::create_channel::subscribe_bots_to_events;
use crate::{Data, mutate_state, read_state};
use canister_api_macros::post_upgrade;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use community_canister::post_upgrade::Args;
use instruction_counts_log::InstructionCountFunctionId;
use stable_memory::get_reader;
use tracing::info;
use utils::env::canister::CanisterEnv;

#[post_upgrade(msgpack = true)]
#[trace]
fn post_upgrade(args: Args) {
    stable_memory_map::init_with_small_entries_map(
        get_stable_memory_map_memory(),
        get_stable_memory_map_small_entries_memory(),
    );

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = Box::new(CanisterEnv::new(data.rng_seed));
    init_state(env, data, args.wasm_version);

    let completed_imports = read_state(|state| state.data.groups_being_imported.completed_imports());

    for group_id in completed_imports {
        finalize_group_import(group_id);
    }

    // One-off: reset the channels' bot subscriptions, since updating a bot used to subscribe it to
    // private channels, and imported groups kept the subscriptions of the bots installed in them
    mutate_state(|state| {
        let data = &mut state.data;
        for channel in data.channels.iter_mut() {
            channel.chat.events.clear_bot_subscriptions();
            if channel.chat.is_public.value {
                subscribe_bots_to_events(&data.bots, &mut channel.chat);
            }
        }
    });

    let total_instructions = ic_cdk::api::call_context_instruction_counter();
    info!(version = %args.wasm_version, total_instructions, "Post-upgrade complete");

    read_state(|state| {
        let now = state.env.now();
        state
            .data
            .record_instructions_count(InstructionCountFunctionId::PostUpgrade, now);
    });
}
