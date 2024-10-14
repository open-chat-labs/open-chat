use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use community_canister::selected_channel_initial::{Response::*, *};
use types::{GroupMember, GroupRole};

#[query(candid = true, msgpack = true)]
fn selected_channel_initial(args: Args) -> Response {
    read_state(|state| selected_channel_initial_impl(args, state))
}

fn selected_channel_initial_impl(args: Args, state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    if !state.data.is_accessible(caller, None) {
        return PrivateCommunity;
    }

    if let Some(channel) = state.data.channels.get(&args.channel_id) {
        let user_id = state.data.members.lookup_user_id(caller);

        if !channel.chat.is_accessible(user_id) {
            return PrivateChannel;
        }

        let chat = &channel.chat;
        let last_updated = chat.details_last_updated();
        let min_visible_message_index = user_id
            .and_then(|u| chat.members.get(&u))
            .map(|m| m.min_visible_message_index())
            .unwrap_or_default();

        let mut members = Vec::new();
        let mut basic_members = Vec::new();
        for member in chat.members.iter().map(GroupMember::from) {
            if matches!(member.role, GroupRole::Participant) && !member.lapsed {
                basic_members.push(member.user_id);
            } else {
                members.push(member);
            }
        }

        Success(SuccessResult {
            timestamp: last_updated,
            last_updated,
            latest_event_index: chat.events.latest_event_index().unwrap_or_default(),
            members,
            basic_members,
            blocked_users: chat.members.blocked(),
            invited_users: chat.invited_users.users(),
            pinned_messages: chat.pinned_messages(min_visible_message_index),
            chat_rules: chat.rules.value.clone().into(),
        })
    } else {
        ChannelNotFound
    }
}
