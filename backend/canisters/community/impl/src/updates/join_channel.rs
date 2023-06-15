use crate::model::channels::Channel;
use crate::model::members::CommunityMemberInternal;
use crate::{activity_notifications::handle_activity_notification, mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use community_canister::join_channel::{Response::*, *};
use gated_groups::{check_if_passes_gate, CheckIfPassesGateResult};
use group_chat_core::AddResult;
use ic_cdk_macros::update;
use types::{AccessGate, CanisterId, ChannelId, EventIndex, MemberJoined, MessageIndex, TimestampMillis, UserId};

#[update]
#[trace]
async fn join_channel(args: Args) -> Response {
    let caller = read_state(|state| state.env.caller());
    join_channel_impl(args.channel_id, caller).await
}

pub(crate) async fn join_channel_impl(channel_id: ChannelId, user_principal: Principal) -> Response {
    match read_state(|state| is_permitted_to_join(channel_id, user_principal, state)) {
        Ok(Some((gate, user_index_canister_id, user_id))) => {
            match check_if_passes_gate(&gate, user_id, user_index_canister_id).await {
                CheckIfPassesGateResult::Success => {}
                CheckIfPassesGateResult::Failed(reason) => return GateCheckFailed(reason),
                CheckIfPassesGateResult::InternalError(error) => return InternalError(error),
            }
        }
        Ok(None) => {}
        Err(response) => return response,
    };

    mutate_state(|state| commit(channel_id, user_principal, state))
}

fn is_permitted_to_join(
    channel_id: ChannelId,
    user_principal: Principal,
    state: &RuntimeState,
) -> Result<Option<(AccessGate, CanisterId, UserId)>, Response> {
    if state.data.is_frozen() {
        return Err(CommunityFrozen);
    }

    if let Some(member) = state.data.members.get(user_principal) {
        if member.suspended.value {
            return Err(UserSuspended);
        }

        if let Some(channel) = state.data.channels.get(&channel_id) {
            if !channel.chat.is_public && channel.chat.invited_users.get(&member.user_id).is_none() {
                return Err(NotInvited);
            }

            if let Some(limit) = channel.chat.members.user_limit_reached() {
                return Err(UserLimitReached(limit));
            }

            if let Some(channel_member) = channel.chat.members.get(&member.user_id) {
                Err(AlreadyInChannel(Box::new(
                    channel.summary(Some(channel_member), state.env.now()),
                )))
            } else {
                Ok(channel
                    .chat
                    .gate
                    .as_ref()
                    .map(|g| (g.clone(), state.data.user_index_canister_id, member.user_id)))
            }
        } else {
            Err(ChannelNotFound)
        }
    } else {
        Err(UserNotInCommunity)
    }
}

fn commit(channel_id: ChannelId, user_principal: Principal, state: &mut RuntimeState) -> Response {
    if let Some(member) = state.data.members.get_mut(user_principal) {
        if let Some(channel) = state.data.channels.get_mut(&channel_id) {
            let now = state.env.now();
            match join_channel_unchecked(channel, member, state.data.is_public, now) {
                AddResult::Success(channel_member) => {
                    let summary = channel.summary(Some(&channel_member), now);
                    handle_activity_notification(state);
                    Success(Box::new(summary))
                }
                AddResult::AlreadyInGroup => {
                    let summary = channel.summary_if_member(&member.user_id, now).unwrap();
                    AlreadyInChannel(Box::new(summary))
                }
                AddResult::Blocked => UserBlocked,
                AddResult::UserLimitReached(limit) => UserLimitReached(limit),
            }
        } else {
            ChannelNotFound
        }
    } else {
        UserNotInCommunity
    }
}

pub(crate) fn join_channel_unchecked(
    channel: &mut Channel,
    member: &mut CommunityMemberInternal,
    notifications_muted: bool,
    now: TimestampMillis,
) -> AddResult {
    let min_visible_event_index;
    let min_visible_message_index;

    if let Some(invitation) = channel.chat.invited_users.get(&member.user_id) {
        min_visible_event_index = invitation.min_visible_event_index;
        min_visible_message_index = invitation.min_visible_message_index;
    } else if channel.chat.history_visible_to_new_joiners {
        min_visible_event_index = EventIndex::default();
        min_visible_message_index = MessageIndex::default();
    } else {
        let events_reader = channel.chat.events.main_events_reader(now);
        min_visible_event_index = events_reader.next_event_index();
        min_visible_message_index = events_reader.next_message_index();
    };

    let result = channel.chat.members.add(
        member.user_id,
        now,
        min_visible_event_index,
        min_visible_message_index,
        notifications_muted,
    );

    match &result {
        AddResult::Success(_) => {
            let invitation = channel.chat.invited_users.remove(&member.user_id, now);

            channel.chat.events.push_main_event(
                ChatEventInternal::ParticipantJoined(Box::new(MemberJoined {
                    user_id: member.user_id,
                    invited_by: invitation.map(|i| i.invited_by),
                })),
                0,
                now,
            );

            member.channels.insert(channel.id);
        }
        AddResult::AlreadyInGroup => {
            member.channels.insert(channel.id);
        }
        AddResult::Blocked | AddResult::UserLimitReached(_) => {}
    }

    result
}
