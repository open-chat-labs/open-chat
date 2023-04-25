use crate::guards::caller_is_openchat_user;
use crate::{mutate_state, read_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use local_user_index_canister::invite_users_to_group::{Response::*, *};
use types::{ChatId, MessageContent, TextContent, UserId};
use user_canister::Event as UserEvent;

#[update(guard = "caller_is_openchat_user")]
#[trace]
async fn invite_users_to_group(args: Args) -> Response {
    let invited_by = read_state(get_user_id);

    let c2c_args = group_canister::c2c_invite_users::Args {
        caller: invited_by,
        user_ids: args.user_ids,
        correlation_id: args.correlation_id,
    };

    match group_canister_c2c_client::c2c_invite_users(args.group_id.into(), &c2c_args).await {
        Ok(response) => match response {
            group_canister::c2c_invite_users::Response::Success(s) => {
                mutate_state(|state| {
                    queue_invitations_to_users(invited_by, args.group_id, s.group_name, &s.invited_users, state);
                });
                Success
            }
            group_canister::c2c_invite_users::Response::CallerNotInGroup => CallerNotInGroup,
            group_canister::c2c_invite_users::Response::NotAuthorized => NotAuthorized,
            group_canister::c2c_invite_users::Response::ChatFrozen => ChatFrozen,
            group_canister::c2c_invite_users::Response::TooManyInvites(l) => TooManyInvites(l),
        },
        Err(error) => InternalError(format!("Failed to call 'group::c2c_invite_users': {error:?}")),
    }
}

fn get_user_id(runtime_state: &RuntimeState) -> UserId {
    let caller = runtime_state.env.caller();
    runtime_state.data.global_users.get(&caller).unwrap().user_id
}

fn queue_invitations_to_users(
    invited_by: UserId,
    group_id: ChatId,
    group_name: String,
    invited_users: &Vec<UserId>,
    runtime_state: &mut RuntimeState,
) {
    let message = format!("You have been invited to the group [{group_name}](/{group_id}) by @UserId({invited_by}).");

    for user_id in invited_users {
        runtime_state.push_event_to_user(
            *user_id,
            UserEvent::OpenChatBotMessage(Box::new(MessageContent::Text(TextContent { text: message.clone() }))),
        );
    }

    crate::jobs::sync_events_to_user_canisters::start_job_if_required(runtime_state);
}
