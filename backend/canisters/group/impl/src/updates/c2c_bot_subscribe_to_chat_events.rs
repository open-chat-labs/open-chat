use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, mutate_state, run_regular_jobs};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::c2c_bot_subscribe_to_chat_events::*;
use oc_error_codes::OCErrorCode;
use std::collections::HashSet;
use types::{BotInitiator, BotPermissions, ChatEventType, ChatPermission, OCResult};

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_bot_subscribe_to_chat_events(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_bot_subscribe_to_chat_events_impl(args, state)).into()
}

fn c2c_bot_subscribe_to_chat_events_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let mut chat_permissions_required = HashSet::new();
    for event_type in args.event_types.iter() {
        match event_type {
            ChatEventType::Message => chat_permissions_required.insert(ChatPermission::ReadMessages),
            ChatEventType::MembershipUpdate => chat_permissions_required.insert(ChatPermission::ReadMembership),
            ChatEventType::ChatDetailsUpdate => chat_permissions_required.insert(ChatPermission::ReadChatDetails),
        };
    }

    if !state.data.is_bot_permitted(
        &args.bot_id,
        &BotInitiator::ApiKeySecret(args.api_key_secret.clone()),
        BotPermissions::default().with_chat(&chat_permissions_required),
    ) {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    state
        .data
        .chat
        .bot_subscribe_to_chat_events(args.bot_id, args.api_key_secret, args.event_types);

    Ok(())
}
