use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, read_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::ChatEventInternal;
use group_canister::enable_invite_code::{Response::*, *};
use group_canister::reset_invite_code;
use oc_error_codes::OCErrorCode;
use rand::rngs::StdRng;
use rand::{RngCore, SeedableRng};
use types::{GroupInviteCodeChange, GroupInviteCodeChanged, OCResult, UserId};
use utils::canister;

#[update(msgpack = true)]
#[trace]
async fn reset_invite_code(args: reset_invite_code::Args) -> reset_invite_code::Response {
    run_regular_jobs();

    let initial_state = match read_state(prepare) {
        Ok(c) => c,
        Err(error) => return Error(error),
    };

    let code = generate_code().await;

    mutate_state(|state| {
        state.data.invite_code = Some(code);
        state.data.invite_code_enabled = true;
        record_event(
            initial_state.user_id,
            GroupInviteCodeChange::Reset,
            args.correlation_id,
            state,
        );
    });

    Success(SuccessResult { code })
}

#[update(candid = true, msgpack = true)]
#[trace]
async fn enable_invite_code(args: Args) -> Response {
    run_regular_jobs();

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
            state.data.invite_code = Some(code);
            state.data.invite_code_enabled = true;
            record_event(
                initial_state.user_id,
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

fn record_event(user_id: UserId, change: GroupInviteCodeChange, correlation_id: u64, state: &mut RuntimeState) {
    let now = state.env.now();
    state.data.chat.events.push_main_event(
        ChatEventInternal::GroupInviteCodeChanged(Box::new(GroupInviteCodeChanged {
            change,
            changed_by: user_id,
        })),
        correlation_id,
        now,
    );

    handle_activity_notification(state);
}

struct PrepareResult {
    user_id: UserId,
    code: Option<u64>,
    enabled: bool,
}

fn prepare(state: &RuntimeState) -> OCResult<PrepareResult> {
    state.data.verify_not_frozen()?;

    let member = state.get_calling_member(true)?;
    if member.role().can_invite_users(&state.data.chat.permissions) {
        Ok(PrepareResult {
            user_id: member.user_id(),
            code: state.data.invite_code,
            enabled: state.data.invite_code_enabled,
        })
    } else {
        Err(OCErrorCode::InitiatorNotAuthorized.into())
    }
}
