use crate::{
    activity_notifications::handle_activity_notification, jobs, mutate_state, read_state, run_regular_jobs,
    AddUsersToChannelResult, RuntimeState,
};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::add_members_to_channel::{Response::*, *};
use types::{AddedToChannelNotification, ChannelId, Notification, UserId, UserType};

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
            state,
        )
    })
}

struct PrepareResult {
    user_id: UserId,
    users_to_add: Vec<(UserId, UserType)>,
    member_display_name: Option<String>,
}

#[allow(clippy::result_large_err)]
fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if state.data.is_frozen() {
        return Err(CommunityFrozen);
    }

    if state.data.is_public.value {
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

                // Only add users who are already community members
                let users_to_add = args
                    .user_ids
                    .iter()
                    .filter(|user_id| state.data.members.contains(user_id))
                    .map(|user_id| (*user_id, state.data.members.bots().get(user_id).copied().unwrap_or_default()))
                    .collect();

                Ok(PrepareResult {
                    user_id,
                    users_to_add,
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
    state: &mut RuntimeState,
) -> Response {
    let now = state.env.now();

    let AddUsersToChannelResult {
        channel_name,
        channel_avatar_id,
        users_added,
        users_already_in_channel,
        users_limit_reached,
        users_failed_with_error,
    } = state.data.add_members_to_channel(&channel_id, users_to_add, added_by, now);

    let Some(channel_name) = channel_name else {
        return ChannelNotFound;
    };

    if users_added.is_empty() {
        return Failed(FailedResult {
            users_already_in_channel,
            users_limit_reached,
            users_failed_with_error,
        });
    }

    let notification = Notification::AddedToChannel(AddedToChannelNotification {
        community_id: state.env.canister_id().into(),
        community_name: state.data.name.value.clone(),
        channel_id,
        channel_name,
        added_by,
        added_by_name,
        added_by_display_name,
        community_avatar_id: state.data.avatar.as_ref().map(|d| d.id),
        channel_avatar_id,
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
}
