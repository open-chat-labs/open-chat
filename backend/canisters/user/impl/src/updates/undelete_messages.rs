use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::{DeleteUndeleteMessagesArgs, Reader, UndeleteMessageResult};
use ic_cdk_macros::update;
use types::EventIndex;
use user_canister::undelete_messages::{Response::*, *};
use user_canister::UserCanisterEvent;
use utils::consts::OPENCHAT_BOT_USER_ID;

#[update(guard = "caller_is_owner")]
#[trace]
fn undelete_messages(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| undelete_messages_impl(args, state))
}

fn undelete_messages_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.suspended.value {
        return UserSuspended;
    }

    if let Some(chat) = state.data.direct_chats.get_mut(&args.user_id.into()) {
        let my_user_id = state.env.canister_id().into();
        let now = state.env.now();

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

        let events_reader = chat.events.main_events_reader();

        let messages: Vec<_> = deleted
            .iter()
            .filter_map(|&message_id| events_reader.message(message_id.into(), Some(my_user_id)))
            .collect();

        if !deleted.is_empty() && args.user_id != OPENCHAT_BOT_USER_ID {
            state.push_user_canister_event(
                args.user_id.into(),
                UserCanisterEvent::UndeleteMessages(Box::new(user_canister::DeleteUndeleteMessagesArgs {
                    message_ids: deleted,
                })),
            );
        }

        Success(SuccessResult { messages })
    } else {
        ChatNotFound
    }
}
