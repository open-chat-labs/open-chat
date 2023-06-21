use std::time::Duration;

use crate::lifecycle::{init_env, init_state, UPGRADE_BUFFER_SIZE};
use crate::memory::get_upgrades_memory;
use crate::model::upgrade_instruction_counts::InstructionCountFunctionId;
use crate::{mutate_state, read_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use group_canister::post_upgrade::Args;
use group_index_canister::c2c_update_group;
use ic_cdk_macros::post_upgrade;
use ic_stable_structures::reader::{BufferedReader, Reader};
use tracing::info;
use types::{CanisterId, Document};

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let env = init_env();

    let memory = get_upgrades_memory();
    let reader = BufferedReader::new(UPGRADE_BUFFER_SIZE, Reader::new(&memory, 0));

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    read_state(|state| {
        let now = state.env.now();
        state
            .data
            .record_instructions_count(InstructionCountFunctionId::PostUpgrade, now)
    });

    // TODO: Remove this one-time sync operation
    mutate_state(|state| {
        if !state.data.synced_gate_with_group_index {
            state.data.synced_gate_with_group_index = true;

            if state.data.chat.gate.value.is_some() {
                ic_cdk_timers::set_timer(Duration::ZERO, sync_access_gate);
            }
        }
    });
}

fn sync_access_gate() {
    let (group_index_canister_id, c2c_update_group_args) = read_state(|state| {
        let c2c_update_group_args = c2c_update_group::Args {
            name: state.data.chat.name.clone(),
            description: state.data.chat.description.clone(),
            avatar_id: Document::id(&state.data.chat.avatar),
            gate: state.data.chat.gate.value.clone(),
        };

        (state.data.group_index_canister_id, c2c_update_group_args)
    });

    ic_cdk::spawn(update_group_index(group_index_canister_id, c2c_update_group_args));

    async fn update_group_index(group_index_canister_id: CanisterId, c2c_update_group_args: c2c_update_group::Args) {
        if group_index_canister_c2c_client::c2c_update_group(group_index_canister_id, &c2c_update_group_args)
            .await
            .is_err()
        {
            mutate_state(|state| {
                state.data.synced_gate_with_group_index = false;
            });
        }
    }
}
