use crate::guards::caller_is_openchat_user;
use crate::{RuntimeState, UserEvent, UserIndexEvent, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use local_user_index_canister::join_group::{Response::*, *};
use types::{ChatId, MessageIndex, TimestampMillis, UserId};

#[update(guard = "caller_is_openchat_user", candid = true, msgpack = true)]
#[trace]
async fn join_group(args: Args) -> Response {
    let user_details =
        mutate_state(|state| state.get_calling_user_and_process_credentials(args.verified_credential_args.as_ref()));

    let c2c_args = group_canister::c2c_join_group::Args {
        user_id: user_details.user_id,
        principal: user_details.principal,
        invite_code: args.invite_code,
        is_platform_moderator: user_details.is_platform_moderator,
        user_type: user_details.user_type,
        diamond_membership_expires_at: user_details.diamond_membership_expires_at,
        verified_credential_args: args.verified_credential_args.clone(),
        unique_person_proof: user_details.unique_person_proof.clone(),
    };
    match group_canister_c2c_client::c2c_join_group(args.chat_id.into(), &c2c_args).await {
        Ok(response) => match response {
            group_canister::c2c_join_group::Response::Success(s)
            | group_canister::c2c_join_group::Response::AlreadyInGroupV2(s) => {
                if !user_details.user_type.is_bot() {
                    mutate_state(|state| {
                        commit(
                            user_details.user_id,
                            args.chat_id,
                            s.latest_message.as_ref().map(|m| m.event.message_index),
                            s.last_updated,
                            state,
                        );
                    });
                }
                Success(s)
            }
            group_canister::c2c_join_group::Response::GateCheckFailed(reason) => GateCheckFailed(reason),
            group_canister::c2c_join_group::Response::Error(error) => Error(error),
        },
        Err(error) => InternalError(format!("Failed to call 'group::c2c_join_group': {error:?}")),
    }
}

fn commit(
    user_id: UserId,
    chat_id: ChatId,
    latest_message_index: Option<MessageIndex>,
    group_canister_timestamp: TimestampMillis,
    state: &mut RuntimeState,
) {
    let local_user_index_canister_id = state.env.canister_id();
    let now = state.env.now();

    if state.data.local_users.get(&user_id).is_some() {
        state.push_event_to_user(
            user_id,
            UserEvent::UserJoinedGroup(Box::new(user_canister::UserJoinedGroup {
                chat_id,
                local_user_index_canister_id,
                latest_message_index,
                group_canister_timestamp,
            })),
            now,
        );
    } else {
        state.push_event_to_user_index(
            UserIndexEvent::UserJoinedGroup(Box::new(user_index_canister::UserJoinedGroup {
                user_id,
                chat_id,
                local_user_index_canister_id,
                latest_message_index,
                group_canister_timestamp,
            })),
            now,
        );
    }
}
