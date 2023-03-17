use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::{DeleteUndeleteMessagesArgs, Reader, UndeleteMessageResult};
use ic_cdk_macros::update;
use types::{CanisterId, EventIndex, MessageId};
use user_canister::c2c_undelete_messages;
use user_canister::undelete_messages::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
fn undelete_messages(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| undelete_messages_impl(args, state))
}

fn undelete_messages_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.suspended.value {
        return UserSuspended;
    }

    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&args.user_id.into()) {
        let my_user_id = runtime_state.env.canister_id().into();
        let now = runtime_state.env.now();

        let delete_message_results = chat.events.undelete_messages(DeleteUndeleteMessagesArgs {
            caller: my_user_id,
            is_admin: false,
            min_visible_event_index: EventIndex::default(),
            thread_root_message_index: None,
            message_ids: args.message_ids,
            now,
        });

        let deleted: Vec<_> = delete_message_results
            .into_iter()
            .filter_map(|(message_id, result)| matches!(result, UndeleteMessageResult::Success).then_some(message_id))
            .collect();

        let events_reader = chat.events.main_events_reader(now);

        let messages: Vec<_> = deleted
            .iter()
            .filter_map(|&message_id| events_reader.message(message_id.into(), Some(my_user_id)))
            .collect();

        if !deleted.is_empty() {
            ic_cdk::spawn(undelete_on_recipients_canister(
                args.user_id.into(),
                deleted,
                args.correlation_id,
            ));
        }

        Success(SuccessResult { messages })
    } else {
        ChatNotFound
    }
}

async fn undelete_on_recipients_canister(canister_id: CanisterId, message_ids: Vec<MessageId>, correlation_id: u64) {
    let args = c2c_undelete_messages::Args {
        message_ids,
        correlation_id,
    };
    let _ = user_canister_c2c_client::c2c_undelete_messages(canister_id, &args).await;
}
