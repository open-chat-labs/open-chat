use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{DeleteUndeleteMessagesArgs, Reader};
use constants::OPENCHAT_BOT_USER_ID;
use oc_error_codes::OCErrorCode;
use types::{EventIndex, OCResult};
use user_canister::UserCanisterEvent;
use user_canister::undelete_messages::{Response::*, *};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn undelete_messages(args: Args) -> Response {
    match execute_update(|state| undelete_messages_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn undelete_messages_impl(args: Args, state: &mut RuntimeState) -> OCResult<SuccessResult> {
    state.data.verify_not_suspended()?;

    let chat = state.data.direct_chats.get_mut_or_err(&args.user_id.into())?;
    let my_user_id = state.env.canister_id().into();
    let now = state.env.now();

    let delete_message_results = chat.events.undelete_messages(DeleteUndeleteMessagesArgs {
        caller: my_user_id,
        is_admin: false,
        min_visible_event_index: EventIndex::default(),
        thread_root_message_index: args.thread_root_message_index,
        message_ids: args.message_ids,
        now,
    });

    let deleted: Vec<_> = delete_message_results
        .into_iter()
        .filter_map(|(message_id, result)| result.is_ok().then_some(message_id))
        .collect();

    let events_reader = chat
        .events
        .events_reader(EventIndex::default(), args.thread_root_message_index, None)
        .ok_or(OCErrorCode::ThreadNotFound)?;

    let messages: Vec<_> = deleted
        .iter()
        .filter_map(|&message_id| events_reader.message(message_id.into(), Some(my_user_id)))
        .collect();

    if !deleted.is_empty() && args.user_id != OPENCHAT_BOT_USER_ID {
        let thread_root_message_id = args.thread_root_message_index.map(|i| chat.main_message_index_to_id(i));

        state.push_user_canister_event(
            args.user_id.into(),
            UserCanisterEvent::UndeleteMessages(Box::new(user_canister::DeleteUndeleteMessagesArgs {
                thread_root_message_id,
                message_ids: deleted,
            })),
        );
    }

    Ok(SuccessResult { messages })
}
