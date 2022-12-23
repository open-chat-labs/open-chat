use crate::model::participants::AddResult;
use crate::updates::handle_activity_notification;
use crate::{mutate_state, read_state, run_regular_jobs, AddParticipantArgs, RuntimeState};
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
        local_user_index_canister_id,
    } = match read_state(prepare) {
        Ok(ok) => ok,
        Err(response) => return *response,
    };

    let c2c_args = local_user_index_canister::c2c_lookup_user::Args {
        user_id_or_principal: user_id.into(),
    };
    match local_user_index_canister_c2c_client::c2c_lookup_user(local_user_index_canister_id, &c2c_args).await {
        Ok(local_user_index_canister::c2c_lookup_user::Response::Success(r)) => {
            if args.as_super_admin && !r.is_super_admin {
                NotSuperAdmin
            } else {
                mutate_state(|state| commit(args, user_id, r.principal, state))
            }
        }
        Ok(local_user_index_canister::c2c_lookup_user::Response::UserNotFound) => UserNotFound,
        Err(error) => InternalError(format!("Failed to call 'local_user_index::c2c_lookup_user': {error:?}")),
    }
}

struct PrepareResult {
    pub user_id: UserId,
    pub local_user_index_canister_id: CanisterId,
}

fn prepare(runtime_state: &RuntimeState) -> Result<PrepareResult, Box<Response>> {
    if runtime_state.data.is_frozen() {
        Err(Box::new(ChatFrozen))
    } else {
        Ok(PrepareResult {
            user_id: runtime_state.env.caller().into(),
            local_user_index_canister_id: runtime_state.data.local_user_index_canister_id,
        })
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

        match runtime_state.add_participant(AddParticipantArgs {
            user_id,
            principal,
            now,
            min_visible_event_index,
            min_visible_message_index,
            as_super_admin: args.as_super_admin,
            mute_notifications: runtime_state.data.is_public,
        }) {
            AddResult::Success(participant) => {
                let event = ParticipantJoined {
                    user_id,
                    as_super_admin: args.as_super_admin,
                };
                runtime_state.data.events.push_main_event(
                    ChatEventInternal::ParticipantJoined(Box::new(event)),
                    args.correlation_id,
                    now,
                );

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
