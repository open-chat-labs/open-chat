use crate::guards::caller_is_owner;
use crate::{RuntimeState, mutate_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::Achievement;
use user_canister::ChatInList;
use user_canister::pin_chat_v2::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn pin_chat_v2(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| pin_chat_impl(args, state))
}

fn pin_chat_impl(args: Args, state: &mut RuntimeState) -> Response {
    let now = state.env.now();

    match args.chat {
        ChatInList::Direct(chat_id) => {
            state.data.direct_chats.pin(chat_id, now);
        }
        ChatInList::Group(chat_id) => {
            state.data.group_chats.pin(chat_id, now);
        }
        ChatInList::Favourite(chat) => {
            state.data.favourite_chats.pin(chat, now);
        }
        ChatInList::Community(community_id, channel_id) => {
            if let Some(community) = state.data.communities.get_mut(&community_id) {
                community.pin(channel_id, now);
            } else {
                return Response::Error(OCErrorCode::ChatNotFound.into());
            }
        }
    }

    state.award_achievement_and_notify(Achievement::PinnedChat, now);

    Response::Success
}
