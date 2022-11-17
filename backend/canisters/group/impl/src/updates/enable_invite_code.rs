use crate::updates::handle_activity_notification;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use candid::Principal;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::{enable_invite_code, reset_invite_code};
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
        Err(PrepareError::NotAuthorized) => return reset_invite_code::Response::NotAuthorized,
        Err(PrepareError::UserFrozen) => return reset_invite_code::Response::UserFrozen,
        Ok(c) => c,
    };

    let code = generate_code().await;

    mutate_state(|runtime_state| {
        runtime_state.data.invite_code = Some(code);
        runtime_state.data.invite_code_enabled = true;
        record_event(
            initial_state.caller,
            GroupInviteCodeChange::Reset,
            args.correlation_id,
            runtime_state,
        );
    });

    reset_invite_code::Response::Success(reset_invite_code::SuccessResult { code })
}

#[update]
#[trace]
async fn enable_invite_code(args: enable_invite_code::Args) -> enable_invite_code::Response {
    run_regular_jobs();

    let initial_state = match read_state(prepare) {
        Err(PrepareError::NotAuthorized) => return enable_invite_code::Response::NotAuthorized,
        Err(PrepareError::UserFrozen) => return enable_invite_code::Response::UserFrozen,
        Ok(c) => c,
    };

    let code = match initial_state.code {
        Some(c) => c,
        None => generate_code().await,
    };

    if !initial_state.enabled {
        mutate_state(|runtime_state| {
            runtime_state.data.invite_code = Some(code);
            runtime_state.data.invite_code_enabled = true;
            record_event(
                initial_state.caller,
                GroupInviteCodeChange::Enabled,
                args.correlation_id,
                runtime_state,
            );
        });
    }

    enable_invite_code::Response::Success(enable_invite_code::SuccessResult { code })
}

async fn generate_code() -> u64 {
    let seed = canister::get_random_seed().await;
    let mut rng = StdRng::from_seed(seed);
    rng.next_u64()
}

fn record_event(caller: Principal, change: GroupInviteCodeChange, correlation_id: u64, runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();

    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        runtime_state.data.events.push_main_event(
            ChatEventInternal::GroupInviteCodeChanged(Box::new(GroupInviteCodeChanged {
                change,
                changed_by: participant.user_id,
            })),
            correlation_id,
            now,
        );

        handle_activity_notification(runtime_state);
    }
}

struct PrepareResult {
    caller: Principal,
    code: Option<u64>,
    enabled: bool,
}

enum PrepareError {
    NotAuthorized,
    UserFrozen,
}

fn prepare(runtime_state: &RuntimeState) -> Result<PrepareResult, PrepareError> {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        if participant.frozen.value {
            return Err(PrepareError::UserFrozen);
        }

        if participant.role.can_invite_users(&runtime_state.data.permissions) {
            return Ok(PrepareResult {
                caller,
                code: runtime_state.data.invite_code,
                enabled: runtime_state.data.invite_code_enabled,
            });
        }
    }

    Err(PrepareError::NotAuthorized)
}
