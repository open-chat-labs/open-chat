use crate::guards::caller_is_owner;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use rand::RngExt;
use types::{Milliseconds, OCResult, TimestampMillis, UserId, UserType};
use user_canister::update_chat_settings::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn update_chat_settings(args: Args) -> Response {
    // TODO: This is async because the User canister looks up users it has no chat with in the
    // LocalUserIndex, which is needed here too once users in other canisters are supported
    mutate_state(|state| update_chat_settings_impl(args, state)).into()
}

fn update_chat_settings_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let my_index = state.caller_user_index_or_trap();
    let my_user_id = state.user_id(my_index);
    let them = args.user_id;
    let now = state.env.now();

    // The other user, if they are a different user in this canister
    let their_index = if them == my_user_id {
        None
    } else if let Some(index) = state.local_user_index(them) {
        Some(index)
    } else {
        // TODO: Users in other canisters need looking up in the LocalUserIndex when there is no
        // chat with them yet, and sending `SetEventsTtl`, as the User canister does
        return Err(OCErrorCode::InvalidRequest
            .with_message("Updating chats with users in other canisters is not yet supported by the MultiUser canister"));
    };

    let events_ttl = args.events_ttl.expand();
    let anonymized_id: u128 = state.env.rng().random();

    // As in the User canister, the chat is created if the user doesn't have it yet
    state.data.users.with_user_mut(my_index, |user| {
        let chat = user
            .direct_chats
            .get_or_create(my_user_id, them, UserType::User, || anonymized_id, now);

        if let Some(events_ttl) = events_ttl {
            chat.set_events_time_to_live(my_user_id, events_ttl, now);
        }
    });

    if let Some(events_ttl) = events_ttl
        && let Some(their_index) = their_index
    {
        set_their_events_ttl(their_index, my_user_id, events_ttl, now, state);
    }

    Ok(())
}

// Applies the time to live the user `sender` set on their copy of the chat to the other user's
// copy, which is the User canister's handling of the `SetEventsTtl` event it receives from the
// sender's canister, applied directly. As there, the other user's copy of the chat is created if
// they don't have it, and nothing is done if they have blocked the sender.
fn set_their_events_ttl(
    their_index: u16,
    sender: UserId,
    events_ttl: Option<Milliseconds>,
    now: TimestampMillis,
    state: &mut RuntimeState,
) {
    let their_user_id = state.user_id(their_index);
    let anonymized_id: u128 = state.env.rng().random();

    state.data.users.with_user_mut(their_index, |user| {
        if user.blocked_users.contains(&sender) {
            return;
        }

        let is_new_chat = !user.direct_chats.exists(&sender.into());
        let chat = user
            .direct_chats
            .get_or_create(their_user_id, sender, UserType::User, || anonymized_id, now);

        // If both users set the time to live at the same time, the one set by the user with the
        // lower id wins, so that it is the same in both copies of the chat
        let last_updated = chat.events().get_events_time_to_live().timestamp;
        if is_new_chat || last_updated < now || (last_updated == now && sender.as_slice() < their_user_id.as_slice()) {
            chat.set_events_time_to_live(sender, events_ttl, now);
        }
    });
}
