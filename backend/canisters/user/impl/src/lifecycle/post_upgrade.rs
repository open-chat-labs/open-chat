use crate::lifecycle::{init_logger, init_state, UPGRADE_BUFFER_SIZE};
use crate::{mutate_state, openchat_bot, read_state, Data, LOG_MESSAGES};
use canister_logger::{LogMessage, LogMessagesWrapper};
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use itertools::Itertools;
use stable_memory::deserialize_from_stable_memory;
use std::time::Duration;
use tracing::info;
use types::{CanisterId, MessageContent, TextContent, UserId};
use user_canister::post_upgrade::Args;
use utils::env::canister::CanisterEnv;
use utils::env::Environment;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    ic_cdk::setup();

    let env = Box::new(CanisterEnv::new());

    let (mut data, log_messages, trace_messages): (Data, Vec<LogMessage>, Vec<LogMessage>) =
        deserialize_from_stable_memory(UPGRADE_BUFFER_SIZE).unwrap();

    init_logger(data.test_mode);
    LOG_MESSAGES.with(|l| rehydrate_log_messages(log_messages, trace_messages, &l.borrow()));

    data.direct_chats.remove_old_deleted_message_content(env.now());

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    if let Some((local_user_index_canister_id, failed_message_counts)) = get_failed_message_counts() {
        notify_failed_messages(local_user_index_canister_id, failed_message_counts);
    }
}

fn rehydrate_log_messages(
    log_messages: Vec<LogMessage>,
    trace_messages: Vec<LogMessage>,
    messages_container: &LogMessagesWrapper,
) {
    for message in log_messages {
        messages_container.logs.push(message);
    }

    for message in trace_messages {
        messages_container.traces.push(message);
    }
}

fn get_failed_message_counts() -> Option<(CanisterId, Vec<UserId>)> {
    read_state(|state| {
        if !state.data.failed_messages_pending_retry.messages.is_empty() {
            let recipients: Vec<_> = state.data.failed_messages_pending_retry.messages.keys().copied().collect();

            Some((state.data.local_user_index_canister_id, recipients))
        } else {
            None
        }
    })
}

fn notify_failed_messages(local_user_index_canister_id: CanisterId, recipients: Vec<UserId>) {
    let users = recipients.iter().map(|u| format!("@UserId{u}")).join("\n");

    mutate_state(|state| {
        openchat_bot::send_message(
            MessageContent::Text(TextContent {
                text: format!(
                    "Due to a bug (which has now been fixed) some of your direct messages to the following users were delayed:

{users}

Apologies for the inconvenience
"
                ),
            }),
            false,
            state,
        )
    });
    ic_cdk::timer::set_timer(Duration::default(), move || {
        ic_cdk::spawn(notify_failed_messages_async(local_user_index_canister_id, recipients));
    });
}

async fn notify_failed_messages_async(local_user_index_canister_id: CanisterId, recipients: Vec<UserId>) {
    let _ = local_user_index_canister_c2c_client::c2c_notify_failed_messages(
        local_user_index_canister_id,
        &local_user_index_canister::c2c_notify_failed_messages::Args { recipients },
    )
    .await;
}
