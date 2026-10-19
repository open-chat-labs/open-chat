use crate::model::subnets::ExpandOntoSubnetStep;
use crate::{mutate_state, read_state};
use candid::Principal;
use canister_timer_jobs::Job;
use constants::{MINUTE_IN_MS, T, min_cycles_balance};
use cycles_minting_canister::notify_create_canister::{Subnet, SubnetSelection};
use ic_cdk::call::RejectCode;
use serde::{Deserialize, Serialize};
use tracing::error;
use types::{C2CError, CanisterId, Cycles, TimestampMillis};
use utils::canister::set_controllers;
use utils::cycles::can_spend_cycles;

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    ExpandOntoSubnet(ExpandOntoSubnetJob),
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ExpandOntoSubnetJob {
    pub subnet_id: Principal,
    pub user_index: CanisterId,
    pub group_index: CanisterId,
    pub notifications_index: CanisterId,
    pub event_relay: CanisterId,
    pub cycles_dispenser: CanisterId,
    pub cmc: CanisterId,
}

impl Job for TimerJob {
    fn execute(self) {
        match self {
            TimerJob::ExpandOntoSubnet(job) => job.execute(),
        }
    }
}

impl Job for ExpandOntoSubnetJob {
    fn execute(self) {
        if let Some((next_step, now)) =
            read_state(|state| state.data.subnets.in_progress().map(|s| (s.next_step(), state.env.now())))
        {
            ic_cdk::futures::spawn_migratory(self.process_step(next_step, now));
        }
    }
}

impl ExpandOntoSubnetJob {
    async fn process_step(self, next_step: ExpandOntoSubnetStep, now: TimestampMillis) {
        let delay = match self.process_step_inner(next_step, now).await {
            Ok(Some(false)) => 0,
            Err(error) => {
                error!("ExpandOntoSubnet processing failed. Step: {next_step:?}. Error: {error:?}",);
                ic_cdk::eprintln!("ExpandOntoSubnet processing failed. Step: {next_step:?}. Error: {error:?}");
                MINUTE_IN_MS
            }
            Ok(Some(true)) | Ok(None) => return,
        };

        mutate_state(|state| {
            let now = state.env.now();
            state
                .data
                .timer_jobs
                .enqueue_job(TimerJob::ExpandOntoSubnet(self), now + delay, now);
        })
    }

    async fn process_step_inner(
        &self,
        next_step: ExpandOntoSubnetStep,
        now: TimestampMillis,
    ) -> Result<Option<bool>, C2CError> {
        let complete = match next_step {
            ExpandOntoSubnetStep::CreateLocalIndex => {
                let canister_id = create_canister(self.cmc, self.subnet_id).await?;

                mutate_state(|state| {
                    state
                        .data
                        .subnets
                        .update_in_progress(|s| s.local_index = Some(canister_id), now)
                })
            }
            ExpandOntoSubnetStep::UpdateControllers(local_index) => {
                let futures: Vec<_> = [(local_index, self.user_index)]
                    .into_iter()
                    .map(|(canister_id, controller)| set_controllers(canister_id, vec![controller]))
                    .collect();

                futures::future::try_join_all(futures).await?;

                mutate_state(|state| state.data.subnets.update_in_progress(|s| s.controllers_updated = true, now))
            }
            ExpandOntoSubnetStep::NotifyCyclesDispenser(local_index) => {
                cycles_dispenser_canister_c2c_client::add_canister(
                    self.cycles_dispenser,
                    &cycles_dispenser_canister::add_canister::Args {
                        canister_id: local_index,
                    },
                )
                .await?;

                mutate_state(|state| {
                    state
                        .data
                        .subnets
                        .update_in_progress(|s| s.cycles_dispenser_notified = true, now)
                })
            }
            ExpandOntoSubnetStep::NotifyEventRelay(local_index) => {
                event_relay_canister_c2c_client::authorize_principals(
                    self.event_relay,
                    &event_relay_canister::authorize_principals::Args {
                        principals: vec![local_index],
                    },
                )
                .await?;

                mutate_state(|state| state.data.subnets.update_in_progress(|s| s.event_relay_notified = true, now))
            }
            ExpandOntoSubnetStep::NotifyNotificationsIndex(local_index) => {
                let response = notifications_index_canister_c2c_client::notify_local_index_added(
                    self.notifications_index,
                    &notifications_index_canister::notify_local_index_added::Args {
                        canister_id: local_index,
                    },
                )
                .await?;

                if matches!(
                    response,
                    notifications_index_canister::notify_local_index_added::Response::Success
                ) {
                    mutate_state(|state| {
                        state
                            .data
                            .subnets
                            .update_in_progress(|s| s.notifications_index_notified = true, now)
                    })
                } else {
                    return Err(C2CError::new(
                        self.notifications_index,
                        "notify_local_index_added",
                        RejectCode::CanisterError,
                        format!("Failed to notify NotificationIndex: {response:?}"),
                    ));
                }
            }
            ExpandOntoSubnetStep::NotifyUserIndex(local_index) => {
                let response = user_index_canister_c2c_client::add_local_user_index_canister(
                    self.user_index,
                    &user_index_canister::add_local_user_index_canister::Args {
                        canister_id: local_index,
                    },
                )
                .await?;

                if matches!(
                    response,
                    user_index_canister::add_local_user_index_canister::Response::Success
                ) {
                    mutate_state(|state| state.data.subnets.update_in_progress(|s| s.user_index_notified = true, now))
                } else {
                    return Err(C2CError::new(
                        self.user_index,
                        "add_local_user_index_canister",
                        RejectCode::CanisterError,
                        format!("Failed to add local user index: {response:?}"),
                    ));
                }
            }
            ExpandOntoSubnetStep::NotifyGroupIndex(local_index) => {
                let response = group_index_canister_c2c_client::notify_local_index_added(
                    self.group_index,
                    &group_index_canister::notify_local_index_added::Args {
                        canister_id: local_index,
                    },
                )
                .await?;

                if matches!(response, group_index_canister::notify_local_index_added::Response::Success) {
                    mutate_state(|state| state.data.subnets.update_in_progress(|s| s.group_index_notified = true, now))
                } else {
                    return Err(C2CError::new(
                        self.group_index,
                        "notify_local_index_added",
                        RejectCode::CanisterError,
                        format!("Failed to notify GroupIndex: {response:?}"),
                    ));
                }
            }
            ExpandOntoSubnetStep::Complete => Some(true),
        };

        Ok(complete)
    }
}

// A new LocalUserIndex starts with enough cycles to be installed and get going; the CyclesDispenser
// keeps it topped up once told of it, a later step
const LOCAL_INDEX_CREATION_CYCLES: Cycles = 10 * T;

// Only the CMC can create a canister on another subnet: it is paid with the cycles attached to the
// call, and makes this canister the controller
async fn create_canister(cmc: CanisterId, subnet: Principal) -> Result<CanisterId, C2CError> {
    let test_mode = read_state(|state| state.data.test_mode);
    if !can_spend_cycles(LOCAL_INDEX_CREATION_CYCLES, min_cycles_balance(test_mode)) {
        return Err(C2CError::new(
            cmc,
            "create_canister",
            RejectCode::CanisterError,
            "Cycles balance too low to create the canister".to_string(),
        ));
    }

    cycles_minting_canister_c2c_client::create_canister(
        cmc,
        &cycles_minting_canister::create_canister::Args {
            subnet_selection: Some(SubnetSelection::Subnet(Subnet { subnet })),
        },
        LOCAL_INDEX_CREATION_CYCLES,
    )
    .await?
    .map_err(|e| C2CError::new(cmc, "create_canister", RejectCode::CanisterError, format!("{e:?}")))
}
