use crate::activity_notifications::handle_activity_notification;
use crate::jobs::process_expire_member_actions;
use crate::{mutate_state, RuntimeState};
use gated_groups::{check_if_passes_gate_synchronously, CheckGateArgs, CheckIfPassesGateResult};
use group_community_common::{ExpiringMember, ExpiringMemberAction, ExpiringMemberActionDetails};
use ic_cdk_timers::TimerId;
use std::time::Duration;
use std::{cell::Cell, mem};
use tracing::trace;
use types::{AccessGateExpiryBehaviour, Milliseconds};

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub const MEMBER_ACCESS_EXPIRY_DELAY: Milliseconds = 5 * 60 * 1000;
const USER_DETAILS_BATCH_SIZE: usize = 1000;

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() {
        if let Some(next_expiry) = state.data.expiring_members.next_expiry() {
            let expiry_delay = if state.data.test_mode { 30 * 1000 } else { MEMBER_ACCESS_EXPIRY_DELAY };
            let timer_id = ic_cdk_timers::set_timer(
                Duration::from_millis((next_expiry + expiry_delay).saturating_sub(state.env.now())),
                run,
            );
            TIMER_ID.set(Some(timer_id));
            return true;
        }
    }

    false
}

pub(crate) fn restart_job(state: &RuntimeState) {
    if let Some(timer_id) = TIMER_ID.get() {
        ic_cdk_timers::clear_timer(timer_id);
        TIMER_ID.set(None);
    }

    start_job_if_required(state);
}

fn run() {
    trace!("'expire_members' job running");
    TIMER_ID.set(None);
    mutate_state(|state| {
        let now = state.env.now();
        let mut users_to_lookup = Vec::new();
        let mut check_gate_actions = Vec::new();
        let mut any_lapsed = false;

        loop {
            let Some(member) = state.data.expiring_members.pop_if_expires_before(now) else {
                break;
            };

            // If there is no longer a gate then continue
            let Some(gate_config) = state.data.get_access_gate_config(member.channel_id) else {
                continue;
            };

            // If there is no longer a gate expiry then continue
            let Some(gate_expiry) = gate_config.expiry() else {
                continue;
            };

            let expiry_gate_type: AccessGateExpiryBehaviour = gate_config.gate().into();

            if matches!(expiry_gate_type, AccessGateExpiryBehaviour::UserLookup) {
                let mut check_gate_args = CheckGateArgs {
                    user_id: member.user_id,
                    diamond_membership_expires_at: None,
                    this_canister: state.env.canister_id(),
                    is_unique_person: false,
                    verified_credential_args: None,
                    referred_by_member: false,
                    now: state.env.now(),
                };

                if let Some(cached_details) = state.data.user_cache.get(&member.user_id) {
                    check_gate_args.diamond_membership_expires_at = cached_details.diamond_membership_expires_at;
                    check_gate_args.is_unique_person = cached_details.is_unique_person;
                }

                let passes_gate = matches!(
                    check_if_passes_gate_synchronously(gate_config.gate().clone(), check_gate_args),
                    Some(CheckIfPassesGateResult::Success)
                );

                if passes_gate {
                    // Queue up the next check
                    if state.data.can_member_lapse(&member.user_id, member.channel_id) {
                        state.data.expiring_members.push(ExpiringMember {
                            expires: now + gate_expiry,
                            channel_id: member.channel_id,
                            user_id: member.user_id,
                        });
                    }
                    continue;
                } else {
                    // Add this member to the list of users to lookup
                    users_to_lookup.push(member.user_id);

                    if users_to_lookup.len() >= USER_DETAILS_BATCH_SIZE {
                        state
                            .data
                            .expiring_member_actions
                            .push(ExpiringMemberAction::UserLookup(mem::take(&mut users_to_lookup)))
                    }
                }
            }

            match expiry_gate_type {
                AccessGateExpiryBehaviour::UserLookup | AccessGateExpiryBehaviour::Check => {
                    check_gate_actions.push(ExpiringMemberActionDetails {
                        user_id: member.user_id,
                        channel_id: member.channel_id,
                        member_expires: member.expires,
                        original_gate_expiry: gate_expiry,
                    });
                }
                AccessGateExpiryBehaviour::Lapse => {
                    state.data.update_lapsed(member.user_id, member.channel_id, true, now);
                    any_lapsed = true;
                }
                AccessGateExpiryBehaviour::Invalid => {
                    // Do nothing
                }
            }
        }

        if !users_to_lookup.is_empty() {
            state
                .data
                .expiring_member_actions
                .push(ExpiringMemberAction::UserLookup(users_to_lookup))
        }

        // Now that the batches of user lookups have been queued then queue all the
        // individual gate check actions
        for action in check_gate_actions {
            state
                .data
                .expiring_member_actions
                .push(ExpiringMemberAction::AsyncGateCheck(action));
        }

        process_expire_member_actions::start_job_if_required(state);
        start_job_if_required(state);

        if any_lapsed {
            handle_activity_notification(state);
        }
    });
}
