use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use user_canister::ChatInList;
use user_canister::unpin_chat_v2::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn unpin_chat_v2(args: Args) -> Response {
    execute_update(|state| unpin_chat_impl(args, state)).into()
}

fn unpin_chat_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let now = state.env.now();

    match args.chat {
        ChatInList::Direct(chat_id) => {
            state.data.direct_chats.unpin(&chat_id, now);
        }
        ChatInList::Group(chat_id) => {
            state.data.group_chats.unpin(&chat_id, now);
        }
        ChatInList::Favourite(chat) => {
            state.data.favourite_chats.unpin(&chat, now);
        }
        ChatInList::Community(community_id, channel_id) => {
            if let Some(community) = state.data.communities.get_mut(&community_id) {
                community.unpin(&channel_id, now);
            } else {
                return Err(OCErrorCode::ChatNotFound.into());
            }
        }
    }

    Ok(())
}
