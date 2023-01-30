use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use types::{ChatId, MessageIndex, Timestamped};
use user_canister::c2c_mark_read_v2;
use user_canister::mark_read_v2::{Response::*, *};
use utils::consts::OPENCHAT_BOT_USER_ID;

#[update(guard = "caller_is_owner")]
#[trace]
fn mark_read_v2(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| mark_read_impl(args, state))
}

fn mark_read_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let now = runtime_state.env.now();

    for chat_messages_read in args.messages_read {
        if let Some(group_chat) = runtime_state.data.group_chats.get_mut(&chat_messages_read.chat_id) {
            if let Some(read_up_to) = chat_messages_read.read_up_to {
                group_chat.mark_read_up_to(read_up_to, now);
            }

            for thread in chat_messages_read.threads {
                group_chat
                    .threads_read
                    .insert(thread.root_message_index, thread.read_up_to, now);
            }

            if chat_messages_read.date_read_pinned > group_chat.date_read_pinned.value {
                group_chat.date_read_pinned = Timestamped::new(chat_messages_read.date_read_pinned, now);
            }
        } else if let Some(direct_chat) = runtime_state.data.direct_chats.get_mut(&chat_messages_read.chat_id) {
            if let Some(read_up_to) = chat_messages_read.read_up_to {
                if read_up_to
                    <= direct_chat
                        .events
                        .main_events_reader(now)
                        .latest_message_index()
                        .unwrap_or_default()
                    && direct_chat.mark_read_up_to(read_up_to, true, now)
                    && direct_chat.them != OPENCHAT_BOT_USER_ID
                {
                    if let Some(read_up_to_of_theirs) =
                        direct_chat.unread_message_index_map.get_max_read_up_to_of_theirs(&read_up_to)
                    {
                        ic_cdk::spawn(mark_read_on_recipients_canister(
                            chat_messages_read.chat_id,
                            read_up_to_of_theirs,
                        ));
                    }
                }
            }
        }
    }

    Success
}

async fn mark_read_on_recipients_canister(chat_id: ChatId, read_up_to: MessageIndex) {
    let args = c2c_mark_read_v2::Args { read_up_to };
    let _ = user_canister_c2c_client::c2c_mark_read_v2(chat_id.into(), &args).await;

    mutate_state(|state| {
        if let Some(chat) = state.data.direct_chats.get_mut(&chat_id) {
            chat.unread_message_index_map.remove_up_to(&read_up_to);
        }
    });
}
