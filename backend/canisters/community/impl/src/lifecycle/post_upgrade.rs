use crate::jobs::import_groups::finalize_group_import;
use crate::lifecycle::{init_env, init_state};
use crate::memory::{get_chat_events_memory, get_upgrades_memory};
use crate::{mutate_state, read_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use community_canister::post_upgrade::Args;
use ic_cdk::post_upgrade;
use instruction_counts_log::InstructionCountFunctionId;
use stable_memory::get_reader;
use tracing::info;
use types::CanisterId;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    chat_events::ChatEvents::init_stable_storage(get_chat_events_memory());

    let memory = get_upgrades_memory();
    let reader = get_reader(&memory);

    let (mut data, errors, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>, Vec<LogEntry>) =
        msgpack::deserialize(reader).unwrap();

    for channel in data.channels.iter_mut() {
        channel.chat.events.init_maps();
        channel.chat.dedupe_at_everyone_mentions();
    }

    if data.local_user_index_canister_id == CanisterId::from_text("nq4qv-wqaaa-aaaaf-bhdgq-cai").unwrap() {
        data.bot_api_gateway_canister_id = CanisterId::from_text("xdh4a-myaaa-aaaaf-bscya-cai").unwrap()
    } else if data.local_user_index_canister_id == CanisterId::from_text("aboy3-giaaa-aaaar-aaaaq-cai").unwrap() {
        data.bot_api_gateway_canister_id = CanisterId::from_text("lvpeh-caaaa-aaaar-boaha-cai").unwrap()
    } else if data.local_user_index_canister_id == CanisterId::from_text("pecvb-tqaaa-aaaaf-bhdiq-cai").unwrap() {
        data.bot_api_gateway_canister_id = CanisterId::from_text("xeg2u-baaaa-aaaaf-bscyq-cai").unwrap()
    }

    canister_logger::init_with_logs(data.test_mode, errors, logs, traces);

    let env = init_env(data.rng_seed);
    init_state(env, data, args.wasm_version);

    let completed_imports = read_state(|state| state.data.groups_being_imported.completed_imports());

    for group_id in completed_imports {
        finalize_group_import(group_id);
    }

    info!(version = %args.wasm_version, "Post-upgrade complete");

    read_state(|state| {
        let now = state.env.now();
        state
            .data
            .record_instructions_count(InstructionCountFunctionId::PostUpgrade, now)
    });

    mutate_state(|state| {
        let now = state.env.now();
        for channel in state.data.channels.iter_mut() {
            channel.chat.events.remove_spurious_video_call_in_progress(now);
        }
    });
}
