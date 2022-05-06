use crate::updates::handle_activity_notification;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use candid::Principal;
use canister_api_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::{enable_invite_code, reset_invite_code};
use ic_cdk_macros::update;
use rand::rngs::StdRng;
use rand::{RngCore, SeedableRng};
use types::{GroupInviteChange, GroupInviteChanged};
use utils::canister;

#[update]
#[trace]
async fn reset_invite_code(_args: reset_invite_code::Args) -> reset_invite_code::Response {
    run_regular_jobs();

    if let Ok(result) = read_state(prepare) {
        let code = generate_and_store_code(result.caller, GroupInviteChange::Reset).await;
        reset_invite_code::Response::Success(reset_invite_code::SuccessResult { code })
    } else {
        reset_invite_code::Response::NotAuthorized
    }
}

#[update]
#[trace]
async fn enable_invite_code(_args: enable_invite_code::Args) -> enable_invite_code::Response {
    run_regular_jobs();

    let result = match read_state(prepare) {
        Err(_) => return enable_invite_code::Response::NotAuthorized,
        Ok(c) => c,
    };

    let code = if result.code.is_some() {
        mutate_state(|runtime_state| {
            runtime_state.data.invite_code_enabled = true;
        });
        result.code.unwrap()
    } else {
        generate_and_store_code(result.caller, GroupInviteChange::Enabled).await
    };

    enable_invite_code::Response::Success(enable_invite_code::SuccessResult { code })
}

async fn generate_and_store_code(caller: Principal, change: GroupInviteChange) -> u64 {
    let seed = canister::get_random_seed().await;
    let mut rng = StdRng::from_seed(seed);
    let invite_code = rng.next_u64();
    mutate_state(|runtime_state| {
        runtime_state.data.invite_code = Some(invite_code);
        runtime_state.data.invite_code_enabled = true;

        let now = runtime_state.env.now();

        if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
            runtime_state.data.events.push_event(
                ChatEventInternal::GroupInviteChanged(Box::new(GroupInviteChanged {
                    change,
                    changed_by: participant.user_id,
                })),
                now,
            );

            handle_activity_notification(runtime_state);
        }
    });
    invite_code
}

struct PrepareResult {
    caller: Principal,
    code: Option<u64>,
}

fn prepare(runtime_state: &RuntimeState) -> Result<PrepareResult, ()> {
    let caller = runtime_state.env.caller();
    if let Some(participant) = runtime_state.data.participants.get_by_principal(&caller) {
        if participant.role.can_invite_users(&runtime_state.data.permissions) {
            return Ok(PrepareResult {
                caller,
                code: runtime_state.data.invite_code,
            });
        }
    }

    Err(())
}
