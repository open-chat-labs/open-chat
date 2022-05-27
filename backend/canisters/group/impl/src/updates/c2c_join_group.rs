use crate::model::participants::AddResult;
use crate::updates::handle_activity_notification;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update_candid_and_msgpack;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::c2c_join_group_v2::{Response::*, *};
use types::{CanisterId, EventIndex, MessageIndex, ParticipantJoined, UserId};
use user_index_canister::c2c_is_super_admin;

// Called via the user's user canister
#[update_candid_and_msgpack]
#[trace]
async fn c2c_join_group_v2(args: Args) -> Response {
    run_regular_jobs();

    let prepare_result = read_state(prepare);
    let user_id = prepare_result.user_id;

    if args.as_super_admin {
        let canister_id = prepare_result.user_index_canister_id;
        let is_super_admin_args = c2c_is_super_admin::Args { user_id };
        match user_index_canister_c2c_client::c2c_is_super_admin(canister_id, &is_super_admin_args).await {
            Ok(user_index_canister::c2c_is_super_admin::Response::Yes) => (),
            Ok(user_index_canister::c2c_is_super_admin::Response::No) => return NotSuperAdmin,
            Err(error) => return InternalError(format!("Failed to call 'user_index::c2c_is_super_admin': {error:?}")),
        };
    }

    mutate_state(|state| commit(args, user_id, state))
}

struct PrepareResult {
    pub user_id: UserId,
    pub user_index_canister_id: CanisterId,
}

fn prepare(runtime_state: &RuntimeState) -> PrepareResult {
    PrepareResult {
        user_id: runtime_state.env.caller().into(),
        user_index_canister_id: runtime_state.data.user_index_canister_id,
    }
}

fn commit(args: Args, user_id: UserId, runtime_state: &mut RuntimeState) -> Response {
    if args.as_super_admin || runtime_state.data.is_accessible_by_non_member(args.invite_code) {
        if let Some(limit) = runtime_state.data.participants.user_limit_reached() {
            return ParticipantLimitReached(limit);
        }

        let now = runtime_state.env.now();
        let min_visible_event_index;
        let min_visible_message_index;
        if runtime_state.data.history_visible_to_new_joiners {
            min_visible_event_index = EventIndex::default();
            min_visible_message_index = MessageIndex::default();
        } else {
            min_visible_event_index = runtime_state.data.events.last().index.incr();
            min_visible_message_index = runtime_state.data.events.next_message_index();
        };

        match runtime_state.data.participants.add(
            user_id,
            args.principal,
            now,
            min_visible_event_index,
            min_visible_message_index,
            args.as_super_admin,
            runtime_state.data.is_public,
        ) {
            AddResult::Success(participant) => {
                let event = ParticipantJoined {
                    user_id,
                    as_super_admin: args.as_super_admin,
                };
                runtime_state
                    .data
                    .events
                    .push_event(ChatEventInternal::ParticipantJoined(Box::new(event)), now);

                handle_activity_notification(runtime_state);

                let summary = runtime_state.summary(&participant);
                Success(summary)
            }
            AddResult::AlreadyInGroup => AlreadyInGroup,
            AddResult::Blocked => Blocked,
        }
    } else {
        GroupNotPublic
    }
}
