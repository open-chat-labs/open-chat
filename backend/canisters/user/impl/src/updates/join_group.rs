use crate::guards::caller_is_owner;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use group_canister::c2c_join_group_v2 as c2c_join_group;
use ic_cdk_macros::update;
use types::{ChatId, GroupChatSummary, MessageIndex, MessageIndexRange};
use user_canister::join_group_v2::{Response::*, *};

#[update(guard = "caller_is_owner")]
#[trace]
async fn join_group_v2(args: Args) -> Response {
    run_regular_jobs();

    let principal = read_state(|state| state.env.caller());

    let c2c_args = c2c_join_group::Args {
        principal,
        as_super_admin: args.as_super_admin,
        invite_code: args.invite_code,
    };

    match group_canister_c2c_client::c2c_join_group_v2(args.chat_id.into(), &c2c_args).await {
        Ok(result) => match result {
            c2c_join_group::Response::Success(summary) => {
                let latest_message_index = summary.latest_message.as_ref().map(|m| m.event.message_index);

                mutate_state(|state| {
                    commit(
                        args.chat_id,
                        args.as_super_admin,
                        summary.notifications_muted,
                        latest_message_index,
                        state,
                    )
                });

                let mut summary: GroupChatSummary = summary.into();
                if let Some(message_index) = latest_message_index {
                    summary.read_by_me.push(MessageIndexRange {
                        from: MessageIndex::default(),
                        to: message_index,
                    });
                }
                Success(summary)
            }
            c2c_join_group::Response::AlreadyInGroup => AlreadyInGroup,
            c2c_join_group::Response::GroupNotPublic => GroupNotPublic,
            c2c_join_group::Response::Blocked => Blocked,
            c2c_join_group::Response::ParticipantLimitReached(limit) => ParticipantLimitReached(limit),
            c2c_join_group::Response::NotSuperAdmin => NotSuperAdmin,
            c2c_join_group::Response::InternalError(error) => {
                InternalError(format!("Failed to call 'group::c2c_join_group': {error:?}"))
            }
        },
        Err(error) => InternalError(format!("{error:?}")),
    }
}

fn commit(
    chat_id: ChatId,
    as_super_admin: bool,
    notifications_muted: bool,
    latest_message_index: Option<MessageIndex>,
    runtime_state: &mut RuntimeState,
) {
    let now = runtime_state.env.now();

    runtime_state
        .data
        .group_chats
        .join(chat_id, as_super_admin, notifications_muted, latest_message_index, now);

    runtime_state.data.recommended_group_exclusions.remove(&chat_id, now);
}
