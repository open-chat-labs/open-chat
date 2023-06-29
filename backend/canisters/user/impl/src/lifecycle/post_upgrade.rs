use crate::lifecycle::{init_env, init_state, UPGRADE_BUFFER_SIZE};
use crate::timer_job_types::TimerJob;
use crate::{mutate_state, Data};
use canister_logger::LogEntry;
use canister_tracing_macros::trace;
use ic_cdk_macros::post_upgrade;
use stable_memory::deserialize_from_stable_memory;
use std::collections::HashSet;
use tracing::info;
use types::{Chat, ChatId};
use user_canister::post_upgrade::Args;
use utils::consts::OPENCHAT_BOT_USER_ID;

#[post_upgrade]
#[trace]
fn post_upgrade(args: Args) {
    let env = init_env();

    let (data, logs, traces): (Data, Vec<LogEntry>, Vec<LogEntry>) =
        deserialize_from_stable_memory(UPGRADE_BUFFER_SIZE).unwrap();

    canister_logger::init_with_logs(data.test_mode, logs, traces);

    init_state(env, data, args.wasm_version);

    info!(version = %args.wasm_version, "Post-upgrade complete");

    // TODO Remove this after the next user canister upgrade
    mutate_state(|state| {
        let direct_chats: HashSet<_> = state.data.direct_chats.iter().map(|c| ChatId::from(c.them)).collect();
        if let Some(chat) = state.data.direct_chats.get_mut(&OPENCHAT_BOT_USER_ID.into()) {
            chat.events.fix_direct_chat_replies(&direct_chats);
        }

        for wrapper in state.data.timer_jobs.jobs.values_mut().map(|(_, w)| w) {
            if let Some(TimerJob::MessageReminder(mr)) = wrapper.borrow_mut().as_mut() {
                if let Chat::Group(c) = mr.chat {
                    if direct_chats.contains(&c) {
                        mr.chat = Chat::Direct(c);
                    }
                }
            }
        }
    });
}
