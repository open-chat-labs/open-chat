use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, look_up_direct_chat_user, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::OPENCHAT_BOT_USER_ID;
use oc_error_codes::OCErrorCode;
use rand::RngExt;
use types::{CanisterId, Milliseconds, OCResult, TimestampMillis, UserId, UserType};
use user_canister::update_chat_settings::*;
use user_canister::{SetEventsTtl, UserCanisterEvent};

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
async fn update_chat_settings(args: Args) -> Response {
    // As in the User canister, a user in another canister whom the caller has no chat with yet is
    // looked up in the LocalUserIndex
    if let Err(local_user_index_canister_id) = read_state(|state| check_chat_exists(args.user_id, state))
        && let Err(error) = look_up_direct_chat_user(local_user_index_canister_id, args.user_id).await
    {
        return Response::Error(error);
    }

    mutate_state(|state| update_chat_settings_impl(args, state)).into()
}

// Ok if `them` needs no looking up: they are the OpenChat bot, a user in this canister, or a user
// the caller already has a chat with. Otherwise the LocalUserIndex to look them up in.
fn check_chat_exists(them: UserId, state: &RuntimeState) -> Result<(), CanisterId> {
    if them == OPENCHAT_BOT_USER_ID || state.user_index(them).is_some() {
        return Ok(());
    }
    let has_chat = state
        .caller_user_index()
        .and_then(|my_index| {
            state
                .data
                .users
                .with_user(my_index, |user| user.direct_chats.get(&them.into()).is_some())
        })
        .unwrap_or_default();
    if has_chat { Ok(()) } else { Err(state.data.local_user_index_canister_id) }
}

fn update_chat_settings_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    // Checked again, since the caller may have been deleted while the other user was looked up
    let my_index = state.caller_user_index().ok_or(OCErrorCode::InitiatorNotAuthorized)?;
    let my_user_id = state.user_id(my_index);
    let them = args.user_id;
    let now = state.env.now();

    // The other user, if they are a different user in this canister
    let their_index = if them == my_user_id {
        None
    } else if let Some(index) = state.index_of_local_user(them) {
        Some(index)
    } else if state.user_index(them).is_some() {
        // An index in this canister which holds no user
        return Err(OCErrorCode::TargetUserNotFound.into());
    } else {
        None
    };

    let events_ttl = args.events_ttl.expand();
    let anonymized_id: u128 = state.env.rng().random();

    // As in the User canister, the chat is created if the user doesn't have it yet
    // The OpenChat bot has no canister to be told of the change, so it applies to the user's copy of
    // the chat alone, as in the User canister
    let their_user_type = if them == OPENCHAT_BOT_USER_ID { UserType::OcControlledBot } else { UserType::User };
    // As in the User canister, only a change is passed on to the other user
    let changed = state
        .data
        .users
        .with_user_mut(my_index, |user| {
            let chat = user
                .direct_chats
                .get_or_create(my_user_id, them, their_user_type, || anonymized_id, now);

            events_ttl.is_some_and(|events_ttl| chat.set_events_time_to_live(my_user_id, events_ttl, now, now).is_some())
        })
        .unwrap_or_default();

    if let Some(events_ttl) = events_ttl.filter(|_| changed) {
        if let Some(their_index) = their_index {
            set_their_events_ttl(their_index, my_user_id, events_ttl, now, state);
        } else if them != my_user_id {
            state.push_user_canister_event(
                my_index,
                them,
                UserCanisterEvent::SetEventsTtl(Box::new(SetEventsTtl {
                    events_ttl,
                    timestamp: now,
                })),
            );
        }
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

        // Unlike between User canisters, where each side applies the other's change some time
        // after its own and so needs a rule to settle two changes made at the same time, both
        // copies are updated here within the one call, so the latest call wins in both
        user.direct_chats
            .get_or_create(their_user_id, sender, UserType::User, || anonymized_id, now)
            .set_events_time_to_live(sender, events_ttl, now, now);
    });
}
