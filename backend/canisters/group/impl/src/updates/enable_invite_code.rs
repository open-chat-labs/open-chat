use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::enable_invite_code::{Response::*, *};
use group_canister::reset_invite_code;
use ic_cdk_macros::update;
use rand::rngs::StdRng;
use rand::{RngCore, SeedableRng};
use types::{GroupInviteCodeChange, GroupInviteCodeChanged};
use utils::canister;

#[update]
#[trace]
async fn reset_invite_code(args: reset_invite_code::Args) -> reset_invite_code::Response {
    run_regular_jobs();

    let initial_state = match read_state(prepare) {
        Ok(c) => c,
        Err(response) => return response,
    };

    let code = generate_code().await;

    mutate_state(|state| {
        state.data.invite_code = Some(code);
        state.data.invite_code_enabled = true;
        record_event(initial_state.caller, GroupInviteCodeChange::Reset, args.correlation_id, state);
    });

    Success(SuccessResult { code })
}

#[update]
#[trace]
async fn enable_invite_code(args: Args) -> Response {
    run_regular_jobs();

    let initial_state = match read_state(prepare) {
        Ok(c) => c,
        Err(response) => return response,
    };

    let code = match initial_state.code {
        Some(c) => c,
        None => generate_code().await,
    };

    if !initial_state.enabled {
        mutate_state(|state| {
            state.data.invite_code = Some(code);
            state.data.invite_code_enabled = true;
            record_event(
                initial_state.caller,
                GroupInviteCodeChange::Enabled,
                args.correlation_id,
                state,
            );
        });
    }

    Success(SuccessResult { code })
}

async fn generate_code() -> u64 {
    let seed = canister::get_random_seed().await;
    let mut rng = StdRng::from_seed(seed);
    rng.next_u64()
}

fn record_event(caller: Principal, change: GroupInviteCodeChange, correlation_id: u64, state: &mut RuntimeState) {
    let now = state.env.now();

    if let Some(member) = state.data.get_member(caller) {
        state.data.chat.events.push_main_event(
            ChatEventInternal::GroupInviteCodeChanged(Box::new(GroupInviteCodeChanged {
                change,
                changed_by: member.user_id,
            })),
            correlation_id,
            now,
        );

        handle_activity_notification(state);
    }
}

struct PrepareResult {
    caller: Principal,
    code: Option<u64>,
    enabled: bool,
}

fn prepare(state: &RuntimeState) -> Result<PrepareResult, Response> {
    if state.data.is_frozen() {
        return Err(ChatFrozen);
    }

    let caller = state.env.caller();
    if let Some(member) = state.data.get_member(caller) {
        if member.suspended.value {
            return Err(UserSuspended);
        }

        if member.role.can_invite_users(&state.data.chat.permissions) {
            return Ok(PrepareResult {
                caller,
                code: state.data.invite_code,
                enabled: state.data.invite_code_enabled,
            });
        }
    }

    Err(NotAuthorized)
}
