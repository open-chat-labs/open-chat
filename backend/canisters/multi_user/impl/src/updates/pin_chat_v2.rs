use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{Achievement, OCResult};
use user_canister::ChatInList;
use user_canister::pin_chat_v2::*;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
fn pin_chat_v2(args: Args) -> Response {
    mutate_state(|state| pin_chat_impl(args, state)).into()
}

fn pin_chat_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let now = state.env.now();
    let my_index = state.caller_user_index_or_trap();

    match args.chat {
        ChatInList::Direct(chat_id) => {
            state.with_caller_user_mut(|_, user| user.direct_chats.pin(chat_id, now));
        }
        ChatInList::Favourite(chat) => {
            state.with_caller_user_mut(|_, user| user.favourite_chats.pin(chat, now));
        }
        // TODO: Groups and channels, once they are held per user
        ChatInList::Group(_) | ChatInList::Community(..) => {
            return Err(OCErrorCode::InvalidRequest
                .with_message("Only direct and favourite chats can be pinned in the MultiUser canister so far"));
        }
    }

    state.award_achievement_and_notify(my_index, Achievement::PinnedChat, now);

    Ok(())
}
