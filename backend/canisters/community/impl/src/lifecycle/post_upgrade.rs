use crate::jobs::import_groups::finalize_group_import;
use crate::lifecycle::{init_env, init_state, UPGRADE_BUFFER_SIZE};
use crate::memory::get_upgrades_memory;
use crate::{read_state, Data};
use canister_tracing_macros::trace;
use community_canister::post_upgrade::Args;
use ic_cdk_macros::post_upgrade;
use ic_stable_structures::reader::{BufferedReader, Reader};
use std::io::Read;
use tracing::info;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let env = init_env();

    let memory = get_upgrades_memory();
    let mut reader = BufferedReader::new(UPGRADE_BUFFER_SIZE, Reader::new(&memory, 0));
    let mut tuple_len_byte = [0u8];
    reader.read_exact(&mut tuple_len_byte).unwrap();
    let data: Data = serializer::deserialize(reader).unwrap();

    canister_logger::init_with_logs(data.test_mode, Vec::new(), Vec::new());

    init_state(env, data, args.wasm_version);

    let completed_imports = read_state(|state| state.data.groups_being_imported.completed_imports());

    for group_id in completed_imports {
        finalize_group_import(group_id);
    }

    info!(version = %args.wasm_version, "Post-upgrade complete");
}
