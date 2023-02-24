use crate::guards::caller_is_openchat_user;
use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use local_user_index_canister::join_group::{Response::*, *};
use types::{ChatId, MessageIndex, UserId};
use user_canister::Event as UserEvent;
use user_index_canister::Event as UserIndexEvent;

#[update(guard = "caller_is_openchat_user")]
#[trace]
async fn join_group(args: Args) -> Response {
    let user_details = read_state(user_details);

    if args.as_super_admin && !user_details.is_super_admin {
        return NotSuperAdmin;
    }

    let c2c_args = group_canister::c2c_join_group::Args {
        user_id: user_details.user_id,
        principal: user_details.principal,
        as_super_admin: args.as_super_admin,
        invite_code: args.invite_code,
        correlation_id: args.correlation_id,
    };
    match group_canister_c2c_client::c2c_join_group(args.chat_id.into(), &c2c_args).await {
        Ok(response) => match response {
            group_canister::c2c_join_group::Response::Success(s) => {
                mutate_state(|state| {
                    commit(
                        user_details.user_id,
                        args.chat_id,
                        args.as_super_admin,
                        s.latest_message.as_ref().map(|m| m.event.message_index),
                        state,
                    );
                });
                Success(s)
            }
            group_canister::c2c_join_group::Response::AlreadyInGroup => AlreadyInGroup,
            group_canister::c2c_join_group::Response::GroupNotPublic => GroupNotPublic,
            group_canister::c2c_join_group::Response::Blocked => Blocked,
            group_canister::c2c_join_group::Response::ParticipantLimitReached(l) => ParticipantLimitReached(l),
            group_canister::c2c_join_group::Response::ChatFrozen => ChatFrozen,
        },
        Err(error) => InternalError(format!("Failed to call 'group::c2c_join_group': {error:?}")),
    }
}

struct UserDetails {
    user_id: UserId,
    principal: Principal,
    is_super_admin: bool,
}

fn user_details(runtime_state: &RuntimeState) -> UserDetails {
    let caller = runtime_state.env.caller();
    let user = runtime_state.data.global_users.get(&caller).unwrap();

    UserDetails {
        user_id: user.user_id,
        principal: user.principal,
        is_super_admin: user.is_super_admin,
    }
}

fn commit(
    user_id: UserId,
    chat_id: ChatId,
    as_super_admin: bool,
    latest_message_index: Option<MessageIndex>,
    runtime_state: &mut RuntimeState,
) {
    if runtime_state.data.local_users.get(&user_id).is_some() {
        runtime_state.data.user_event_sync_queue.push(
            user_id.into(),
            UserEvent::UserJoinedGroup(Box::new(user_canister::UserJoinedGroup {
                chat_id,
                as_super_admin,
                latest_message_index,
            })),
        );
        crate::jobs::sync_events_to_user_canisters::start_job_if_required(runtime_state);
    } else {
        runtime_state.data.user_index_event_sync_queue.push(
            runtime_state.data.user_index_canister_id,
            UserIndexEvent::UserJoinedGroup(user_index_canister::UserJoinedGroup {
                user_id,
                chat_id,
                as_super_admin,
                latest_message_index,
            }),
        );
        crate::jobs::sync_events_to_user_index_canister::start_job_if_required(runtime_state);
    }
}
