use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use types::{ChatId, Timestamped};
use user_canister::archive_chat::*;

#[update(guard = "caller_is_owner")]
#[trace]
fn archive_chat(args: Args) -> Response {
    toggle_archive_chat(args.chat_id, true)
}

#[update(guard = "caller_is_owner")]
#[trace]
fn unarchive_chat(args: Args) -> Response {
    toggle_archive_chat(args.chat_id, false)
}

fn toggle_archive_chat(chat_id: ChatId, archive: bool) -> Response {
    run_regular_jobs();

    mutate_state(|state| {
        let now = state.env.now();

        if archive {
            // Unpin the chat if it is pinned
            state.data.unpin_chat(chat_id, now);
        }

        if let Some(dc) = state.data.direct_chats.get_mut(&chat_id) {
            dc.archived = Timestamped::new(archive, now);
            Response::Success
        } else if let Some(gc) = state.data.group_chats.get_mut(&chat_id) {
            gc.archived = Timestamped::new(archive, now);
            Response::Success
        } else {
            Response::ChatNotFound
        }
    })
}
