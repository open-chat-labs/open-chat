use crate::model::expiring_members::ExpiringMember;
use crate::{model::expiring_member_actions::ExpiringMemberAction, mutate_state, RuntimeState};
use ic_cdk_timers::TimerId;
use std::time::Duration;
use std::{cell::Cell, mem};
use tracing::trace;
use types::{AccessGate, Milliseconds};

thread_local! {
    static TIMER_ID: Cell<Option<TimerId>> = Cell::default();
}

const EXPIRY_DELAY: Milliseconds = 5 * 60 * 1000;
const USER_DETAILS_BATCH_SIZE: usize = 1000;

pub(crate) fn start_job_if_required(state: &RuntimeState) -> bool {
    if TIMER_ID.get().is_none() {
        if let Some(next_expiry) = state.data.expiring_members.next_expiry() {
            let timer_id = ic_cdk_timers::set_timer(
                Duration::from_millis((next_expiry + EXPIRY_DELAY).saturating_sub(state.env.now())),
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
        let mut user_details_actions = Vec::new();

        for member in state.data.expiring_members.pop_if_expires_before(now) {
            if let Some(gate_config) = state.data.get_access_gate_config(member.channel_id) {
                match gate_config.gate {
                    AccessGate::DiamondMember | AccessGate::LifetimeDiamondMember | AccessGate::UniquePerson => {
                        let mut passes_gate_expiry = None;

                        if let Some(user_details) = state.data.user_cache.get(&member.user_id) {
                            let passes_gate = match gate_config.gate {
                                AccessGate::DiamondMember => user_details.is_diamond(now),
                                AccessGate::LifetimeDiamondMember => user_details.is_lifetime_diamond_member(),
                                AccessGate::UniquePerson => user_details.is_unique_person,
                                _ => unreachable!(),
                            };

                            passes_gate_expiry = passes_gate.then_some(gate_config.expiry()).flatten();
                        }

                        if let Some(passes_gate_expiry) = passes_gate_expiry {
                            state.data.expiring_members.push(ExpiringMember {
                                expires: now + passes_gate_expiry,
                                channel_id: member.channel_id,
                                user_id: member.user_id,
                            });
                        } else {
                            user_details_actions.push((member.user_id, member.channel_id));

                            if user_details_actions.len() >= USER_DETAILS_BATCH_SIZE {
                                state
                                    .data
                                    .expiring_member_actions
                                    .push(ExpiringMemberAction::UserDetails(mem::take(&mut user_details_actions)));
                            }
                        }
                    }
                    AccessGate::Payment(_) | AccessGate::VerifiedCredential(_) => {
                        state.data.expire_member(member.user_id, member.channel_id, now);
                    }
                    AccessGate::SnsNeuron(_) => {
                        state
                            .data
                            .expiring_member_actions
                            .push(ExpiringMemberAction::SnsNeuron(member.user_id, member.channel_id));
                    }
                    AccessGate::TokenBalance(_) => {
                        state
                            .data
                            .expiring_member_actions
                            .push(ExpiringMemberAction::TokenBalance(member.user_id, member.channel_id));
                    }
                    AccessGate::Composite(_) | AccessGate::Locked | AccessGate::ReferredByMember => {
                        // Do nothing
                    }
                }
            }
        }

        if !user_details_actions.is_empty() {
            state
                .data
                .expiring_member_actions
                .push(ExpiringMemberAction::UserDetails(user_details_actions));
        }

        start_job_if_required(state);
    });
}
