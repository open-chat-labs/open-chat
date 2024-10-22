use crate::guards::caller_is_owner;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::Achievement;
use user_canister::pin_chat_v2::{Response::*, *};
use user_canister::ChatInList;

#[update(guard = "caller_is_owner", candid = true, msgpack = true)]
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
                return ChatNotFound;
            }
        }
    }

    state.data.award_achievement_and_notify(Achievement::PinnedChat, now);

    Success
}
