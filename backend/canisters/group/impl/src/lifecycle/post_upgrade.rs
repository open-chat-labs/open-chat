use crate::lifecycle::{init_env, init_state, UPGRADE_BUFFER_SIZE};
use crate::memory::get_upgrades_memory;
use crate::model::upgrade_instruction_counts::InstructionCountFunctionId;
use crate::{read_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use group_canister::post_upgrade::Args;
use ic_cdk_macros::post_upgrade;
use ic_stable_structures::reader::{BufferedReader, Reader};
use tracing::info;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let env = init_env();

    let memory = get_upgrades_memory();
    let reader = BufferedReader::new(UPGRADE_BUFFER_SIZE, Reader::new(&memory, 0));

    let (mut data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    // One-off code to migrate InvitedUsers to no longer hold principals
    let users = data.chat.invited_users.rebuild_users_map();
    for (principal, user_id) in users {
        data.principal_to_user_id_map.insert(principal, user_id);
    }

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    read_state(|state| {
        let now = state.env.now();
        state
            .data
            .record_instructions_count(InstructionCountFunctionId::PostUpgrade, now)
    });
}
