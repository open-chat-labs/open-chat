use crate::lifecycle::{init_logger, init_state};
use crate::{Data, StateVersion, LOG_MESSAGES};
use canister_api_macros::trace;
use canister_logger::{set_panic_hook, LogMessage, LogMessagesWrapper};
use ic_cdk_macros::post_upgrade;
use open_storage_index_canister::add_or_update_users::UserConfig;
use tracing::info;
use user_index_canister::post_upgrade::Args;
use utils::env::canister::CanisterEnv;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    set_panic_hook();

    let (version, bytes): (StateVersion, Vec<u8>) = ic_cdk::storage::stable_restore().unwrap();
    let env = Box::new(CanisterEnv::new());

    match version {
        StateVersion::V1 => {
            let (mut data, log_messages, trace_messages): (Data, Vec<LogMessage>, Vec<LogMessage>) =
                serializer::deserialize(&bytes).unwrap();

            // This is a 1 time job and will be removed in the next commit
            for principal in data.users.iter().map(|u| u.get_principal()) {
                data.open_storage_user_sync_queue.push(UserConfig {
                    user_id: principal,
                    byte_limit: 100 * 1024 * 1024,
                });
            }

            init_logger(data.test_mode);
            init_state(env, data, args.wasm_version);

            if !log_messages.is_empty() || !trace_messages.is_empty() {
                LOG_MESSAGES.with(|l| rehydrate_log_messages(log_messages, trace_messages, &l.borrow()))
            }
        }
    };

    info!("Post-upgrade complete");
}

fn rehydrate_log_messages(
    log_messages: Vec<LogMessage>,
    trace_messages: Vec<LogMessage>,
    messages_container: &LogMessagesWrapper,
) {
    for message in log_messages.into_iter() {
        messages_container.logs.push(message);
    }

    for message in trace_messages.into_iter() {
        messages_container.traces.push(message);
    }
}
