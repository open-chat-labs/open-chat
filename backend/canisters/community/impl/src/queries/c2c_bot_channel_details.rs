use crate::guards::caller_is_local_user_index;
use crate::read_state;
use crate::RuntimeState;
use canister_api_macros::query;
use community_canister::c2c_bot_channel_details::{Response::*, *};
use std::cmp::max;
use types::BotPermissions;
use types::ChatDetails;
use types::ChatPermission;
use types::EventIndex;

#[query(guard = "caller_is_local_user_index", msgpack = true)]
fn c2c_bot_channel_details(args: Args) -> Response {
    read_state(|state| match c2c_bot_channel_details_impl(args, state) {
        Some(details) => Success(details),
        None => NotAuthorized,
    })
}

fn c2c_bot_channel_details_impl(args: Args, state: &RuntimeState) -> Option<ChatDetails> {
    if !state.data.is_bot_permitted(
        &args.bot_id,
        Some(args.channel_id),
        &args.initiator,
        BotPermissions::from_chat_permission(ChatPermission::ReadChatDetails),
    ) {
        return None;
    }

    let channel = state.data.channels.get(&args.channel_id)?;
    let chat = &channel.chat;
    let events_ttl = chat.events.get_events_time_to_live();
    let main_events_reader = chat.events.visible_main_events_reader(EventIndex::default());

    Some(ChatDetails {
        name: chat.name.value.clone(),
        description: chat.description.value.clone(),
        rules: chat.rules.value.clone().into(),
        avatar_id: types::Document::id(&chat.avatar),
        is_public: chat.is_public.value,
        history_visible_to_new_joiners: chat.history_visible_to_new_joiners,
        messages_visible_to_non_members: chat.messages_visible_to_non_members.value,
        permissions: chat.permissions.value.clone(),
        events_ttl: events_ttl.value,
        events_ttl_last_updated: if events_ttl.timestamp == 0 { None } else { Some(events_ttl.timestamp) },
        gate_config: chat.gate_config.value.clone().map(|gc| gc.into()),
        video_call_in_progress: chat.events.video_call_in_progress().value.clone(),
        verified: None,
        frozen: None,
        date_last_pinned: chat.date_last_pinned,
        last_updated: max(chat.last_updated(None), channel.date_imported.unwrap_or_default()),
        external_url: chat.external_url.value.clone(),
        latest_event_index: main_events_reader.latest_event_index().unwrap_or_default(),
        latest_message_index: main_events_reader.latest_message_index(),
        member_count: chat.members.len(),
    })
}
