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

    let c2c_args = group_canister::c2c_join_group::Args {
        user_id: user_details.user_id,
        principal: user_details.principal,
        correlation_id: args.correlation_id,
        is_platform_moderator: user_details.is_platform_moderator,
    };
    match group_canister_c2c_client::c2c_join_group(args.chat_id.into(), &c2c_args).await {
        Ok(response) => match response {
            group_canister::c2c_join_group::Response::Success(s)
            | group_canister::c2c_join_group::Response::AlreadyInGroupV2(s) => {
                mutate_state(|state| {
                    commit(
                        user_details.user_id,
                        args.chat_id,
                        s.latest_message.as_ref().map(|m| m.event.message_index),
                        state,
                    );
                });
                Success(s)
            }
            group_canister::c2c_join_group::Response::AlreadyInGroup => AlreadyInGroup,
            group_canister::c2c_join_group::Response::GateCheckFailed(msg) => GateCheckFailed(msg),
            group_canister::c2c_join_group::Response::GroupNotPublic => GroupNotPublic,
            group_canister::c2c_join_group::Response::Blocked => Blocked,
            group_canister::c2c_join_group::Response::ParticipantLimitReached(l) => ParticipantLimitReached(l),
            group_canister::c2c_join_group::Response::ChatFrozen => ChatFrozen,
            group_canister::c2c_join_group::Response::InternalError(error) => InternalError(error),
        },
        Err(error) => InternalError(format!("Failed to call 'group::c2c_join_group': {error:?}")),
    }
}

struct UserDetails {
    user_id: UserId,
    principal: Principal,
    is_platform_moderator: bool,
}

fn user_details(runtime_state: &RuntimeState) -> UserDetails {
    let caller = runtime_state.env.caller();
    let user = runtime_state.data.global_users.get(&caller).unwrap();

    UserDetails {
        user_id: user.user_id,
        principal: user.principal,
        is_platform_moderator: user.is_platform_moderator,
    }
}

fn commit(user_id: UserId, chat_id: ChatId, latest_message_index: Option<MessageIndex>, runtime_state: &mut RuntimeState) {
    if runtime_state.data.local_users.get(&user_id).is_some() {
        runtime_state.push_event_to_user(
            user_id,
            UserEvent::UserJoinedGroup(Box::new(user_canister::UserJoinedGroup {
                chat_id,
                latest_message_index,
            })),
        );
        crate::jobs::sync_events_to_user_canisters::start_job_if_required(runtime_state);
    } else {
        runtime_state.push_event_to_user_index(
            runtime_state.data.user_index_canister_id,
            UserIndexEvent::UserJoinedGroup(user_index_canister::UserJoinedGroup {
                user_id,
                chat_id,
                as_super_admin: false,
                latest_message_index,
            }),
        );
        crate::jobs::sync_events_to_user_index_canister::start_job_if_required(runtime_state);
    }
}
