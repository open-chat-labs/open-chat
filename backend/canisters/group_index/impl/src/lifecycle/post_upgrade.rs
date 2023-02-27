use crate::lifecycle::{init_env, init_state, UPGRADE_BUFFER_SIZE};
use crate::memory::get_upgrades_memory;
use crate::updates::c2c_delete_group::delete_group;
use crate::{read_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use group_index_canister::post_upgrade::Args;
use ic_cdk_macros::post_upgrade;
use ic_stable_structures::reader::{BufferedReader, Reader};
use std::time::Duration;
use tracing::info;
use types::ChatId;
use utils::consts::OPENCHAT_BOT_USER_ID;
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

    // TODO delete this
    ic_cdk_timers::set_timer(Duration::default(), || {
        ic_cdk::spawn(delete_frozen_groups());
    });
}

async fn delete_frozen_groups() {
    let groups = read_state(|state| state.data.cached_metrics.frozen_groups.clone());

    info!(count = groups.len(), "Deleting frozen groups");
    futures::future::join_all(groups.into_iter().map(delete_frozen_group)).await;
}

async fn delete_frozen_group(chat_id: ChatId) {
    let _ = group_canister_c2c_client::c2c_unfreeze_group(
        chat_id.into(),
        &group_canister::c2c_unfreeze_group::Args {
            caller: OPENCHAT_BOT_USER_ID,
        },
    )
    .await;

    if let Ok(group_canister::c2c_freeze_group::Response::SuccessWithMembers(_, members)) =
        group_canister_c2c_client::c2c_freeze_group(
            chat_id.into(),
            &group_canister::c2c_freeze_group::Args {
                caller: OPENCHAT_BOT_USER_ID,
                reason: None,
                return_members: true,
            },
        )
        .await
    {
        if let Some(local_group_index) = read_state(|state| state.data.local_index_map.get_index_canister(&chat_id)) {
            let _ = delete_group(chat_id, local_group_index, OPENCHAT_BOT_USER_ID, chat_id.to_string(), members).await;
            info!(%chat_id, "Frozen group deleted");
        }
    }
}
