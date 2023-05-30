use crate::guards::caller_is_user_index_or_local_user_index;
use crate::{mutate_state, read_state, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use community_canister::join_channel::{Response::*, *};
use gated_groups::{check_if_passes_gate, CheckIfPassesGateResult};
use group_members::AddResult;
use ic_cdk_macros::update;
use types::{CanisterId, ChannelId, EventIndex, GroupGate, MemberJoined, MessageIndex, UserId};

#[update(guard = "caller_is_user_index_or_local_user_index")]
#[trace]
async fn join_channel(args: Args) -> Response {
    match read_state(|state| is_permitted_to_join(args.channel_id, state)) {
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

    mutate_state(|state| join_channel_impl(args.channel_id, state))
}

fn is_permitted_to_join(
    channel_id: ChannelId,
    state: &RuntimeState,
) -> Result<Option<(GroupGate, CanisterId, UserId)>, Response> {
    if state.data.is_frozen() {
        return Err(CommunityFrozen);
    }

    let caller = state.env.caller();

    if let Some(member) = state.data.members.get(caller) {
        if member.suspended.value {
            return Err(UserSuspended);
        }

        if let Some(channel) = state.data.channels.get(&channel_id) {
            if let Some(limit) = channel.chat.members.user_limit_reached() {
                return Err(UserLimitReached(limit));
            }

            if let Some(channel_member) = channel.chat.members.get(&member.user_id) {
                Err(AlreadyInCommunity(Box::new(channel.summary(channel_member, state.env.now()))))
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

fn join_channel_impl(channel_id: ChannelId, state: &mut RuntimeState) -> Response {
    let caller = state.env.caller();
    if let Some(member) = state.data.members.get(caller) {
        if let Some(channel) = state.data.channels.get_mut(&channel_id) {
            let now = state.env.now();
            let mut min_visible_event_index = EventIndex::default();
            let mut min_visible_message_index = MessageIndex::default();

            if !channel.chat.history_visible_to_new_joiners {
                let events_reader = channel.chat.events.main_events_reader(now);
                min_visible_event_index = events_reader.next_event_index();
                min_visible_message_index = events_reader.next_message_index();
            }

            match channel.chat.members.add(
                member.user_id,
                now,
                min_visible_event_index,
                min_visible_message_index,
                state.data.is_public,
            ) {
                AddResult::Success(channel_member) => {
                    channel.chat.events.push_main_event(
                        ChatEventInternal::ParticipantJoined(Box::new(MemberJoined {
                            user_id: member.user_id,
                            invited_by: None,
                        })),
                        0,
                        now,
                    );

                    let summary = channel.summary(&channel_member, now);
                    Success(Box::new(summary))
                }
                AddResult::AlreadyInGroup => {
                    let channel_member = channel.chat.members.get(&member.user_id).unwrap();
                    let summary = channel.summary(channel_member, now);
                    AlreadyInCommunity(Box::new(summary))
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
