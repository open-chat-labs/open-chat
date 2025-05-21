use crate::activity_notifications::handle_activity_notification;
use crate::model::events::CommunityEventInternal;
use crate::{RuntimeState, execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use community_canister::enable_invite_code::{Response::*, *};
use community_canister::reset_invite_code;
use oc_error_codes::OCErrorCode;
use rand::rngs::StdRng;
use rand::{RngCore, SeedableRng};
use types::{GroupInviteCodeChange, GroupInviteCodeChanged, OCResult, Timestamped, UserId};
use utils::canister;

#[update(msgpack = true)]
#[trace]
async fn reset_invite_code(_args: reset_invite_code::Args) -> reset_invite_code::Response {
    execute_update_async(reset_invite_code_impl).await
}

async fn reset_invite_code_impl() -> reset_invite_code::Response {
    let initial_state = match read_state(prepare) {
        Ok(c) => c,
        Err(error) => return Error(error),
    };

    let code = generate_code().await;

    mutate_state(|state| {
        let now = state.env.now();
        state.data.invite_code = Timestamped::new(Some(code), now);
        state.data.invite_code_enabled = Timestamped::new(true, now);
        record_event(initial_state.user_id, GroupInviteCodeChange::Reset, state);
    });

    Success(SuccessResult { code })
}

#[update(candid = true, msgpack = true)]
#[trace]
async fn enable_invite_code(_args: Args) -> Response {
    execute_update_async(enable_invite_code_impl).await
}

async fn enable_invite_code_impl() -> Response {
    let initial_state = match read_state(prepare) {
        Ok(c) => c,
        Err(error) => return Error(error),
    };

    let code = match initial_state.code {
        Some(c) => c,
        None => generate_code().await,
    };

    if !initial_state.enabled {
        mutate_state(|state| {
            let now = state.env.now();
            state.data.invite_code = Timestamped::new(Some(code), now);
            state.data.invite_code_enabled = Timestamped::new(true, now);
            record_event(initial_state.user_id, GroupInviteCodeChange::Enabled, state);
        });
    }

    Success(SuccessResult { code })
}

async fn generate_code() -> u64 {
    let seed = canister::get_random_seed().await;
    let mut rng = StdRng::from_seed(seed);
    rng.next_u64()
}

fn record_event(user_id: UserId, change: GroupInviteCodeChange, state: &mut RuntimeState) {
    let now = state.env.now();

    if let Some(participant) = state.data.members.get_by_user_id(&user_id) {
        state.data.events.push_event(
            CommunityEventInternal::InviteCodeChanged(Box::new(GroupInviteCodeChanged {
                change,
                changed_by: participant.user_id,
            })),
            now,
        );

        handle_activity_notification(state);
    }
}

struct PrepareResult {
    user_id: UserId,
    code: Option<u64>,
    enabled: bool,
}

fn prepare(state: &RuntimeState) -> OCResult<PrepareResult> {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;
    if member.role().can_invite_users(&state.data.permissions) {
        Ok(PrepareResult {
            user_id: member.user_id,
            code: state.data.invite_code.value,
            enabled: state.data.invite_code_enabled.value,
        })
    } else {
        Err(OCErrorCode::InitiatorNotAuthorized.into())
    }
}
