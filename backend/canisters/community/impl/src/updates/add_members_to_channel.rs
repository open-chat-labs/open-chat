use crate::{
    AddUsersToChannelResult, RuntimeState, activity_notifications::handle_activity_notification, execute_update, jobs,
};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::add_members_to_channel::{Response::*, *};
use futures::channel;
use oc_error_codes::OCErrorCode;
use types::{AddedToChannelNotification, ChannelId, CommunityId, FcmData, OCResult, UserId, UserNotificationPayload, UserType};

#[update(msgpack = true)]
#[trace]
fn add_members_to_channel(args: Args) -> Response {
    execute_update(|state| add_members_to_channel_impl(args, state))
}

fn add_members_to_channel_impl(args: Args, state: &mut RuntimeState) -> Response {
    let prepare_result = match prepare(&args, state) {
        Ok(ok) => ok,
        Err(response) => return Error(response),
    };

    commit(
        prepare_result.user_id,
        args.added_by_name,
        prepare_result.member_display_name.or(args.added_by_display_name),
        args.channel_id,
        prepare_result.users_to_add,
        state,
    )
}

struct PrepareResult {
    user_id: UserId,
    users_to_add: Vec<(UserId, UserType)>,
    member_display_name: Option<String>,
}

fn prepare(args: &Args, state: &RuntimeState) -> OCResult<PrepareResult> {
    state.data.verify_not_frozen()?;

    if state.data.is_public.value {
        return Err(OCErrorCode::CommunityPublic.into());
    }

    let member = state.get_calling_member(true)?;
    let user_id = member.user_id;
    let channel = state.data.channels.get_or_err(&args.channel_id)?;

    if let Some(limit) = channel.chat.members.user_limit_reached() {
        Err(OCErrorCode::UserLimitReached.with_message(limit))
    } else if let Some(channel_member) = channel.chat.members.get(&user_id) {
        let permissions = &channel.chat.permissions;
        if !channel_member.role().can_add_members(permissions) {
            return Err(OCErrorCode::InitiatorNotAuthorized.into());
        } else if channel_member.lapsed().value {
            return Err(OCErrorCode::InitiatorLapsed.into());
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
        Err(OCErrorCode::InitiatorNotInChat.into())
    }
}

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
        bot_notification,
    } = state.data.add_members_to_channel(&channel_id, users_to_add, added_by, now);

    let Some(channel_name) = channel_name else {
        return Error(OCErrorCode::ChatNotFound.into());
    };

    if users_added.is_empty() {
        return Failed(FailedResult {
            users_already_in_channel,
            users_limit_reached,
            users_failed_with_error,
        });
    }

    let community_id: CommunityId = state.env.canister_id().into();
    let community_avatar_id = state.data.avatar.as_ref().map(|d| d.id);

    // TODO i18n
    let fcm_body = format!("You have been added to channel {}", channel_name.clone());
    let fcm_data = FcmData::for_community_chat(community_id, channel_id)
        .set_body(fcm_body)
        .set_sender_name_with_alt(&added_by_display_name, &added_by_name)
        .set_avatar_id(community_avatar_id);

    let notification = UserNotificationPayload::AddedToChannel(AddedToChannelNotification {
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

    state.push_notification(Some(added_by), users_added.clone(), notification, fcm_data);
    state.push_bot_notification(bot_notification);

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
