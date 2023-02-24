use crate::lifecycle::{init_env, init_state, UPGRADE_BUFFER_SIZE};
use crate::{mutate_state, Data};
use candid::Principal;
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use stable_memory::deserialize_from_stable_memory;
use std::time::Duration;
use tracing::info;
use types::ChatId;
use user_canister::post_upgrade::Args;
use crate::updates::leave_group;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let env = init_env();

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) =
        deserialize_from_stable_memory(UPGRADE_BUFFER_SIZE).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    mutate_state(|state| {
        let chat_id: ChatId = Principal::from_text("vfaj4-zyaaa-aaaaf-aabya-cai").unwrap().into();
        if state.data.group_chats.get(&chat_id).filter(|g| g.date_joined < 1676715563224).is_some() {
            ic_cdk_timers::set_timer(Duration::default(), move || ic_cdk::spawn(join_group(chat_id)));
        }
    });
}

async fn join_group(chat_id: ChatId) {
    let local_user_index_canister_id =
        match group_canister_c2c_client::local_user_index(chat_id.into(), &group_canister::local_user_index::Args {}).await {
            Ok(group_canister::local_user_index::Response::Success(c)) => c,
            _ => return,
        };

    let _ = local_user_index_canister_c2c_client::join_group(
        local_user_index_canister_id,
        &local_user_index_canister::join_group::Args {
            chat_id,
            as_super_admin: false,
            invite_code: None,
            correlation_id: 0,
        },
    )
    .await;
}
