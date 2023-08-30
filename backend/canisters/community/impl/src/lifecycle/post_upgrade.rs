use crate::jobs::import_groups::finalize_group_import;
use crate::lifecycle::{init_env, init_state, UPGRADE_BUFFER_SIZE};
use crate::memory::get_upgrades_memory;
use crate::updates::c2c_join_channel::join_channel_unchecked;
use crate::{mutate_state, read_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use community_canister::post_upgrade::Args;
use ic_cdk_macros::post_upgrade;
use ic_stable_structures::reader::{BufferedReader, Reader};
use tracing::info;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let env = init_env();

    let memory = get_upgrades_memory();
    let reader = BufferedReader::new(UPGRADE_BUFFER_SIZE, Reader::new(&memory, 0));

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    init_state(env, data, args.wasm_version);

    let completed_imports = read_state(|state| state.data.groups_being_imported.completed_imports());

    for group_id in completed_imports {
        finalize_group_import(group_id);
    }

    // One time job to add community members to all imported public channels
    mutate_state(|state| {
        let now = state.env.now();
        for channel in state.data.channels.iter_mut().filter(|c| c.date_imported.is_some()) {
            if channel.chat.is_public && channel.chat.gate.is_none() {
                for member in state.data.members.iter_mut() {
                    join_channel_unchecked(channel, member, true, now);
                }
            }
        }
    });

    info!(version = %args.wasm_version, "Post-upgrade complete");
}
