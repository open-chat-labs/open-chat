use crate::guards::caller_is_openchat_user;
use crate::{mutate_state, read_state, RuntimeState};
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use local_user_index_canister::join_group::{Response::*, *};
use types::{ChatId, MessageIndex, UserId};
use user_canister::Event as UserEvent;
use user_index_canister::Event as UserIndexEvent;

#[update(guard = "caller_is_openchat_user")]
#[trace]
async fn join_group(args: Args) -> Response {
    let user_details = read_state(|state| state.calling_user());

    let c2c_args = group_canister::c2c_join_group::Args {
        user_id: user_details.user_id,
        principal: user_details.principal,
        invite_code: args.invite_code,
        correlation_id: args.correlation_id,
        is_platform_moderator: user_details.is_platform_moderator,
        is_bot: user_details.is_bot,
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
            group_canister::c2c_join_group::Response::NotInvited => NotInvited,
            group_canister::c2c_join_group::Response::GroupNotPublic => NotInvited,
            group_canister::c2c_join_group::Response::Blocked => Blocked,
            group_canister::c2c_join_group::Response::ParticipantLimitReached(l) => ParticipantLimitReached(l),
            group_canister::c2c_join_group::Response::ChatFrozen => ChatFrozen,
            group_canister::c2c_join_group::Response::InternalError(error) => InternalError(error),
        },
        Err(error) => InternalError(format!("Failed to call 'group::c2c_join_group': {error:?}")),
    }
}

fn commit(user_id: UserId, chat_id: ChatId, latest_message_index: Option<MessageIndex>, state: &mut RuntimeState) {
    if state.data.local_users.get(&user_id).is_some() {
        state.push_event_to_user(
            user_id,
            UserEvent::UserJoinedGroup(Box::new(user_canister::UserJoinedGroup {
                chat_id,
                latest_message_index,
            })),
        );
    } else {
        state.push_event_to_user_index(UserIndexEvent::UserJoinedGroup(Box::new(
            user_index_canister::UserJoinedGroup {
                user_id,
                chat_id,
                latest_message_index,
            },
        )));
    }
}
