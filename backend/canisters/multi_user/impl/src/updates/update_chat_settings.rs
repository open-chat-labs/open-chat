use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, execute_update_async, look_up_direct_chat_user, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::OPENCHAT_BOT_USER_ID;
use oc_error_codes::OCErrorCode;
use rand::RngExt;
use types::{CanisterId, OCResult, UserId, UserType};
use user_canister::update_chat_settings::*;
use user_canister::{SetEventsTtl, UserCanisterEvent};

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
async fn update_chat_settings(args: Args) -> Response {
    execute_update_async(|| update_chat_settings_impl(args)).await
}

async fn update_chat_settings_impl(args: Args) -> Response {
    // As in the User canister, a user in another canister whom the caller has no chat with yet is
    // looked up in the LocalUserIndex, which gives whether they are a user or a bot
    let mut their_user_type = UserType::User;
    if let Err(local_user_index_canister_id) = read_state(|state| check_chat_exists(args.user_id, state)) {
        match look_up_direct_chat_user(local_user_index_canister_id, args.user_id).await {
            Ok(user_type) => their_user_type = user_type,
            Err(error) => return Response::Error(error),
        }
    }

    mutate_state(|state| commit(args, their_user_type, state)).into()
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
                .with_user(my_index, |user| user.direct_chats.exists(&them.into()))
        })
        .unwrap_or_default();
    if has_chat { Ok(()) } else { Err(state.data.local_user_index_canister_id) }
}

fn commit(args: Args, their_user_type: UserType, state: &mut RuntimeState) -> OCResult {
    // Checked again, since the caller may have been deleted while the other user was looked up
    let my_index = state.caller_user_index().ok_or(OCErrorCode::InitiatorNotAuthorized)?;
    let my_user_id = state.user_id(my_index);
    let them = args.user_id;
    let now = state.env.now();

    if state.user_index(them).is_some() && state.index_of_local_user(them).is_none() {
        // An index in this canister which holds no user
        return Err(OCErrorCode::TargetUserNotFound.into());
    }

    let events_ttl = args.events_ttl.expand();
    let anonymized_id: u128 = state.env.rng().random();

    // As in the User canister, the chat is created if the user doesn't have it yet
    // The OpenChat bot has no canister to be told of the change, so it applies to the user's copy of
    // the chat alone, as in the User canister
    let their_user_type = if them == OPENCHAT_BOT_USER_ID { UserType::OcControlledBot } else { their_user_type };
    // As in the User canister, only a change is passed on to the other user
    let changed_at = state
        .data
        .users
        .with_user_mut(my_index, |user| {
            let mut chat = user
                .direct_chats
                .get_or_create(my_user_id, them, their_user_type, || anonymized_id, now);

            events_ttl.and_then(|events_ttl| chat.set_events_time_to_live(my_user_id, events_ttl, now))
        })
        .flatten();

    if let (Some(events_ttl), Some(changed_at)) = (events_ttl, changed_at) {
        state.send_user_canister_event(
            my_index,
            them,
            UserCanisterEvent::SetEventsTtl(Box::new(SetEventsTtl {
                events_ttl,
                timestamp: changed_at,
            })),
        );
    }

    Ok(())
}
