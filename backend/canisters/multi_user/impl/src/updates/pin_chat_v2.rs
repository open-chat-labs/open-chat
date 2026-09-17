use crate::guards::caller_is_owner;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use user_canister::ChatInList;
use user_canister::pin_chat_v2::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
fn pin_chat_v2(args: Args) -> Response {
    mutate_state(|state| pin_chat_impl(args, state)).into()
}

fn pin_chat_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let now = state.env.now();

    match args.chat {
        ChatInList::Direct(chat_id) => {
            state.with_caller_user_mut(|_, user| user.direct_chats.pin(chat_id, now));
        }
        // TODO: Groups, favourites and channels, once they are held per user
        ChatInList::Group(_) | ChatInList::Favourite(_) | ChatInList::Community(..) => {
            return Err(
                OCErrorCode::InvalidRequest.with_message("Only direct chats can be pinned in the MultiUser canister so far")
            );
        }
    }

    // TODO: Award the `PinnedChat` achievement, once achievements are held per user

    Ok(())
}
