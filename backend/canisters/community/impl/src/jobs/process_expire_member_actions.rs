use crate::{
    model::{expiring_member_actions::ExpiringMemberAction, expiring_members::ExpiringMember},
    mutate_state, read_state, RuntimeState,
};
use gated_groups::{check_if_passes_gate, CheckGateArgs, CheckIfPassesGateResult};
use ic_cdk_timers::TimerId;
use local_user_index_canister_c2c_client::lookup_users;
use std::cell::Cell;
use std::time::Duration;
use tracing::trace;
use types::{ChannelId, Milliseconds, UserId};

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() && !state.data.expiring_member_actions.is_empty() {
        let timer_id = ic_cdk_timers::set_timer(Duration::ZERO, run);
        TIMER_ID.set(Some(timer_id));
        true
    } else {
        false
    }
}

fn run() {
    trace!("'expire_members' job running");
    TIMER_ID.set(None);

    let actions = mutate_state(|state| state.data.expiring_member_actions.pop_batch());

    for action in actions {
        ic_cdk::spawn(process_action(action));
    }

    read_state(start_job_if_required);
}

async fn process_action(action: ExpiringMemberAction) {
    match action {
        ExpiringMemberAction::UserDetails(vec) => process_user_details_action(&vec).await,
        ExpiringMemberAction::TokenBalance(user_id, channel_id) => process_gate_check(user_id, channel_id).await,
        ExpiringMemberAction::SnsNeuron(user_id, channel_id) => process_gate_check(user_id, channel_id).await,
    }
}

async fn process_user_details_action(user_details_args: &[(UserId, Option<ChannelId>)]) {
    let local_user_index_canister = read_state(|state| state.data.local_user_index_canister_id);
    let user_ids = user_details_args.iter().map(|(user_id, _)| *user_id).collect();

    match lookup_users(user_ids, local_user_index_canister).await {
        Ok(user_details) => mutate_state(|state| {
            for u in user_details.values() {
                state
                    .data
                    .user_cache
                    .insert(u.user_id, u.diamond_membership_expires_at, u.unique_person_proof.is_some());
            }

            for (user_id, channel_id) in user_details_args {
                process_gate_check(*user_id, *channel_id);
            }
        }),
        Err(_) => mutate_state(|state| {
            for (user_id, channel_id) in user_details_args {
                requeue_member_expiry(*user_id, *channel_id, state);
            }
        }),
    }
}

async fn process_gate_check(user_id: UserId, channel_id: Option<ChannelId>) {
    let Some(gate_config) = read_state(|state| state.data.get_access_gate_config(channel_id).cloned()) else {
        return;
    };

    let check_gate_args = read_state(|state| {
        let (diamond_membership_expires_at, is_unique_person) = state
            .data
            .user_cache
            .get(&user_id)
            .map_or((None, false), |u| (u.diamond_membership_expires_at, u.is_unique_person));

        CheckGateArgs {
            user_id,
            diamond_membership_expires_at,
            this_canister: state.env.canister_id(),
            is_unique_person,
            verified_credential_args: None,
            referred_by_member: false,
            now: state.env.now(),
        }
    });

    let gate_expiry = gate_config.expiry();
    let result = check_if_passes_gate(gate_config.gate, check_gate_args).await;

    mutate_state(|state| {
        let now = state.env.now();

        match result {
            CheckIfPassesGateResult::Success => {
                if let Some(expiry) = gate_expiry {
                    state.data.expiring_members.push(ExpiringMember {
                        expires: now + expiry,
                        channel_id,
                        user_id,
                    });
                }
            }
            CheckIfPassesGateResult::Failed(_) => {
                //
                state.data.expire_member(user_id, channel_id, now)
            }
            CheckIfPassesGateResult::InternalError(_) => {
                requeue_member_expiry(user_id, channel_id, state);
            }
        }
    });
}

fn requeue_member_expiry(user_id: UserId, channel_id: Option<ChannelId>, state: &mut RuntimeState) {
    const EXPIRY_DELAY: Milliseconds = 5 * 60 * 1000;
    state.data.expiring_members.push(ExpiringMember {
        expires: state.env.now() + EXPIRY_DELAY,
        channel_id,
        user_id,
    });
}
