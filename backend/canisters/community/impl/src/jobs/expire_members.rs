use crate::jobs::process_expire_member_actions;
use crate::model::expiring_member_actions::ExpiringMemberActionDetails;
use crate::model::expiring_members::ExpiringMember;
use crate::{model::expiring_member_actions::ExpiringMemberAction, mutate_state, RuntimeState};
use gated_groups::{check_if_passes_gate_synchronously, CheckGateArgs, CheckIfPassesGateResult};
use ic_cdk_timers::TimerId;
use std::time::Duration;
use std::{cell::Cell, mem};
use tracing::trace;
use types::{AccessGateExpiryType, AccessGateType, Milliseconds};

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

pub const MEMBER_ACCESS_EXPIRY_DELAY: Milliseconds = 5 * 60 * 1000;
const USER_DETAILS_BATCH_SIZE: usize = 1000;

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() {
        if let Some(next_expiry) = state.data.expiring_members.next_expiry() {
            let timer_id = ic_cdk_timers::set_timer(
                Duration::from_millis((next_expiry + MEMBER_ACCESS_EXPIRY_DELAY).saturating_sub(state.env.now())),
                run,
            );
            TIMER_ID.set(Some(timer_id));
            return true;
        }
    }

    false
}

fn run() {
    trace!("'expire_members' job running");
    TIMER_ID.set(None);
    mutate_state(|state| {
        let now = state.env.now();
        let mut batched_actions = Vec::new();

        for member in state.data.expiring_members.pop_if_expires_before(now) {
            // If there is no longer a gate then continue
            let Some(gate_config) = state.data.get_access_gate_config(member.channel_id) else {
                continue;
            };

            // If there is no longer a gate expiry then continue
            let Some(gate_expiry) = gate_config.expiry() else {
                continue;
            };

            let gate_type: AccessGateType = gate_config.gate().into();
            let expiry_gate_type: AccessGateExpiryType = gate_config.gate().into();

            match expiry_gate_type {
                AccessGateExpiryType::Batch => {
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
                    } else {
                        // Add this member to the list of batchable actions
                        batched_actions.push(ExpiringMemberActionDetails {
                            user_id: member.user_id,
                            channel_id: member.channel_id,
                            member_expires: member.expires,
                            original_gate_type: gate_type,
                            original_gate_expiry: gate_expiry,
                        });

                        if batched_actions.len() >= USER_DETAILS_BATCH_SIZE {
                            state
                                .data
                                .expiring_member_actions
                                .push(ExpiringMemberAction::Batch(mem::take(&mut batched_actions)))
                        }
                    }
                }
                AccessGateExpiryType::Lapse => {
                    state.data.mark_member_lapsed(member.user_id, member.channel_id, now);
                }
                AccessGateExpiryType::Single => {
                    state
                        .data
                        .expiring_member_actions
                        .push(ExpiringMemberAction::Single(ExpiringMemberActionDetails {
                            user_id: member.user_id,
                            channel_id: member.channel_id,
                            member_expires: member.expires,
                            original_gate_type: gate_type,
                            original_gate_expiry: gate_expiry,
                        }));
                }
                AccessGateExpiryType::Invalid => {
                    // Do nothing
                }
            }
        }

        if !batched_actions.is_empty() {
            state
                .data
                .expiring_member_actions
                .push(ExpiringMemberAction::Batch(batched_actions))
        }

        process_expire_member_actions::start_job_if_required(state);
        start_job_if_required(state);
    });
}
