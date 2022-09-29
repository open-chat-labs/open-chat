use crate::model::participants::AddResult;
use crate::updates::handle_activity_notification;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use candid::Principal;
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::c2c_join_group_v2::{Response::*, *};
use types::{CanisterId, EventIndex, MessageIndex, ParticipantJoined, UserId};

// Called via the user's user canister
#[update_msgpack]
#[trace]
async fn c2c_join_group_v2(args: Args) -> Response {
    run_regular_jobs();

    let PrepareResult {
        user_id,
        user_index_canister_id,
    } = read_state(prepare);

    let c2c_args = user_index_canister::c2c_lookup_principal::Args { user_id };
    match user_index_canister_c2c_client::c2c_lookup_principal(user_index_canister_id, &c2c_args).await {
        Ok(user_index_canister::c2c_lookup_principal::Response::Success(r)) => {
            if args.as_super_admin && !r.is_super_admin {
                NotSuperAdmin
            } else {
                mutate_state(|state| commit(args, user_id, r.principal, state))
            }
        }
        Ok(user_index_canister::c2c_lookup_principal::Response::UserNotFound) => UserNotFound,
        Err(error) => InternalError(format!("Failed to call 'user_index::c2c_lookup_principal': {error:?}")),
    }
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

fn commit(args: Args, user_id: UserId, principal: Principal, runtime_state: &mut RuntimeState) -> Response {
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
            min_visible_event_index = runtime_state.data.events.main().last().index.incr();
            min_visible_message_index = runtime_state.data.events.main().next_message_index();
        };

        match runtime_state.data.participants.add(
            user_id,
            principal,
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
                    .push_main_event(ChatEventInternal::ParticipantJoined(Box::new(event)), args.correlation_id, now);

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
