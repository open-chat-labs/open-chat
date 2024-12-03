use crate::{
    activity_notifications::handle_activity_notification, jobs, mutate_state, read_state, run_regular_jobs, RuntimeState,
};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use community_canister::add_members_to_channel::{Response::*, *};
use group_chat_core::AddResult;
use group_community_common::ExpiringMember;
use types::{AddedToChannelNotification, ChannelId, EventIndex, MembersAdded, MessageIndex, Notification, UserId, UserType};

#[update(msgpack = true)]
#[trace]
fn add_members_to_channel(args: Args) -> Response {
    run_regular_jobs();

    let prepare_result = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    mutate_state(|state| {
        commit(
            prepare_result.user_id,
            args.added_by_name,
            prepare_result.member_display_name.or(args.added_by_display_name),
            args.channel_id,
            prepare_result.users_to_add,
            prepare_result.users_already_in_channel,
            prepare_result.users_not_in_community,
            state,
        )
    })
}

struct PrepareResult {
    user_id: UserId,
    users_to_add: Vec<(UserId, UserType)>,
    users_already_in_channel: Vec<UserId>,
    users_not_in_community: Vec<UserId>,
    member_display_name: Option<String>,
}

#[allow(clippy::result_large_err)]
fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if state.data.is_frozen() {
        return Err(CommunityFrozen);
    }

    if state.data.is_public {
        return Err(CommunityPublic);
    }

    let caller = state.env.caller();

    if let Some(member) = state.data.members.get(caller) {
        if member.suspended().value {
            return Err(UserSuspended);
        } else if member.lapsed().value {
            return Err(UserLapsed);
        }

        let user_id = member.user_id;

        if let Some(channel) = state.data.channels.get(&args.channel_id) {
            if let Some(limit) = channel.chat.members.user_limit_reached() {
                Err(UserLimitReached(limit))
            } else if let Some(channel_member) = channel.chat.members.get(&user_id) {
                let permissions = &channel.chat.permissions;
                if !channel_member.role().can_add_members(permissions) {
                    return Err(NotAuthorized);
                } else if channel_member.lapsed().value {
                    return Err(UserLapsed);
                }

                let mut users_to_add = Vec::new();
                let mut users_already_in_channel = Vec::new();
                let mut users_not_in_community = Vec::new();

                for user_id in args.user_ids.iter() {
                    if let Some(member) = state.data.members.get_by_user_id(user_id) {
                        if !channel.chat.members.contains(user_id) {
                            users_to_add.push((*user_id, member.user_type));
                        } else {
                            users_already_in_channel.push(*user_id);
                        }
                    } else {
                        users_not_in_community.push(*user_id);
                    }
                }

                Ok(PrepareResult {
                    user_id,
                    users_to_add,
                    users_already_in_channel,
                    users_not_in_community,
                    member_display_name: member.display_name().value.clone(),
                })
            } else {
                Err(UserNotInChannel)
            }
        } else {
            Err(ChannelNotFound)
        }
    } else {
        Err(UserNotInCommunity)
    }
}

#[allow(clippy::too_many_arguments)]
fn commit(
    added_by: UserId,
    added_by_name: String,
    added_by_display_name: Option<String>,
    channel_id: ChannelId,
    users_to_add: Vec<(UserId, UserType)>,
    mut users_already_in_channel: Vec<UserId>,
    _users_not_in_community: Vec<UserId>,
    state: &mut RuntimeState,
) -> Response {
    let mut users_failed_with_error: Vec<UserFailedError> = Vec::new();

    if let Some(channel) = state.data.channels.get_mut(&channel_id) {
        let mut min_visible_event_index = EventIndex::default();
        let mut min_visible_message_index = MessageIndex::default();

        if !channel.chat.history_visible_to_new_joiners {
            let events_reader = channel.chat.events.main_events_reader();
            min_visible_event_index = events_reader.next_event_index();
            min_visible_message_index = events_reader.next_message_index();
        }

        let now = state.env.now();

        let mut users_added: Vec<UserId> = Vec::new();
        let mut users_limit_reached: Vec<UserId> = Vec::new();

        let gate_expiry = channel.chat.gate_config.value.as_ref().and_then(|gc| gc.expiry());

        for (user_id, user_type) in users_to_add {
            match channel.chat.members.add(
                user_id,
                now,
                min_visible_event_index,
                min_visible_message_index,
                channel.chat.is_public.value,
                user_type,
            ) {
                AddResult::Success(_) => {
                    users_added.push(user_id);
                    state.data.members.mark_member_joined_channel(user_id, channel_id);

                    if let Some(gate_expiry) = gate_expiry {
                        state.data.expiring_members.push(ExpiringMember {
                            expires: now + gate_expiry,
                            channel_id: Some(channel_id),
                            user_id,
                        });
                    }
                }
                AddResult::AlreadyInGroup => users_already_in_channel.push(user_id),
                AddResult::MemberLimitReached(_) => users_limit_reached.push(user_id),
                AddResult::Blocked => users_failed_with_error.push(UserFailedError {
                    user_id,
                    error: "User blocked".to_string(),
                }),
            }
        }

        if users_added.is_empty() {
            return Failed(FailedResult {
                users_already_in_channel,
                users_limit_reached,
                users_failed_with_error,
            });
        }

        let event = MembersAdded {
            user_ids: users_added.clone(),
            added_by,
            unblocked: Vec::new(),
        };

        channel
            .chat
            .events
            .push_main_event(ChatEventInternal::ParticipantsAdded(Box::new(event)), 0, now);

        let notification = Notification::AddedToChannel(AddedToChannelNotification {
            community_id: state.env.canister_id().into(),
            community_name: state.data.name.clone(),
            channel_id,
            channel_name: channel.chat.name.value.clone(),
            added_by,
            added_by_name,
            added_by_display_name,
            community_avatar_id: state.data.avatar.as_ref().map(|d| d.id),
            channel_avatar_id: channel.chat.avatar.as_ref().map(|d| d.id),
        });

        state.push_notification(users_added.clone(), notification);

        jobs::expire_members::start_job_if_required(state);

        handle_activity_notification(state);

        if !users_already_in_channel.is_empty() || !users_failed_with_error.is_empty() {
            PartialSuccess(PartialSuccessResult {
                users_added,
                users_limit_reached,
                users_already_in_channel,
                users_failed_with_error,
            })
        } else {
            Success
        }
    } else {
        ChannelNotFound
    }
}
