use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use user_canister::ChatInList;
use user_canister::unpin_chat_v2::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn unpin_chat_v2(args: Args) -> Response {
    mutate_state(|state| unpin_chat_impl(args, state)).into()
}

fn unpin_chat_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let now = state.env.now();

    match args.chat {
        ChatInList::Direct(chat_id) => {
            state.with_caller_user_mut(|_, user| user.direct_chats.unpin(&chat_id, now));
            Ok(())
        }
        ChatInList::Favourite(chat) => {
            state.with_caller_user_mut(|_, user| user.favourite_chats.unpin(&chat, now));
            Ok(())
        }
        ChatInList::Group(chat_id) => {
            state.with_caller_user_mut(|_, user| user.group_chats.unpin(&chat_id, now));
            Ok(())
        }
        ChatInList::Community(community_id, channel_id) => state.with_caller_user_mut(|_, user| {
            user.communities
                .get_mut(&community_id)
                .map(|community| community.unpin(&channel_id, now))
                .ok_or_else(|| OCErrorCode::ChatNotFound.into())
        }),
    }
}
