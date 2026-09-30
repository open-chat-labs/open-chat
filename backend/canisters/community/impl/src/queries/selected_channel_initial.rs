use crate::{RuntimeState, read_state};
use canister_api_macros::query;
use community_canister::selected_channel_initial::{Response::*, *};
use types::OCResult;

#[query(msgpack = true)]
fn selected_channel_initial(args: Args) -> Response {
    match read_state(|state| selected_channel_initial_impl(args, state)) {
        Ok(result) => Success(result),
        Err(error) => Error(error),
    }
}

fn selected_channel_initial_impl(args: Args, state: &RuntimeState) -> OCResult<SuccessResult> {
    let caller = state.env.caller();
    state.data.verify_is_accessible(caller, None)?;

    let channel = state.data.channels.get_or_err(&args.channel_id)?;
    let user_id = state.data.members.lookup_user_id(caller);
    channel.chat.verify_is_accessible(user_id)?;

    let chat = &channel.chat;
    let last_updated = channel.details_last_updated();
    let min_visible_message_index = user_id
        .and_then(|u| chat.members.get(&u))
        .map(|m| m.min_visible_message_index())
        .unwrap_or_default();

    let members = chat.members.page(None, args.max_members);

    Ok(SuccessResult {
        timestamp: last_updated,
        last_updated,
        latest_event_index: chat.events.latest_event_index().unwrap_or_default(),
        members: members.members,
        basic_members: members.basic_members,
        more_members_after: members.more_members_after,
        blocked_users: chat.members.blocked(),
        invited_users: chat.invited_users.user_ids().copied().collect(),
        pinned_messages: chat.pinned_messages(min_visible_message_index),
        chat_rules: chat.rules.value.clone().into(),
        webhooks: chat.webhooks(),
    })
}
