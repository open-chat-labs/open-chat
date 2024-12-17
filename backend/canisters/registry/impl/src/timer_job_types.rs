use crate::model::subnets::ExpandOntoNewSubnetStep;
use crate::{mutate_state, read_state};
use candid::Principal;
use canister_timer_jobs::Job;
use constants::{MINUTE_IN_MS, NANOS_PER_MILLISECOND};
use cycles_minting_canister::notify_create_canister::{Subnet, SubnetSelection};
use ic_cdk::api::call::{CallResult, RejectionCode};
use ic_cdk::api::management_canister::main::{CanisterSettings, UpdateSettingsArgument};
use ic_ledger_types::{AccountIdentifier, Memo, Subaccount, Timestamp, Tokens, TransferArgs, DEFAULT_FEE};
use serde::{Deserialize, Serialize};
use types::{CanisterId, TimestampMillis};

const MEMO_CREATE_CANISTER: Memo = Memo(0x41455243); // == 'CREA'

#[derive(Serialize, Deserialize, Clone)]
pub enum TimerJob {
    ExpandOntoNewSubnet(ExpandOntoNewSubnetJob),
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ExpandOntoNewSubnetJob {
    pub subnet_id: Principal,
    pub this_canister_id: CanisterId,
    pub user_index: CanisterId,
    pub group_index: CanisterId,
    pub notifications_index: CanisterId,
    pub event_relay: CanisterId,
    pub cycles_dispenser: CanisterId,
    pub ledger: CanisterId,
    pub cmc: CanisterId,
    pub create_canister_block_index: Option<u64>,
}

impl Job for TimerJob {
    fn execute(self) {
        match self {
            TimerJob::ExpandOntoNewSubnet(job) => job.execute(),
        }
    }
}

impl Job for ExpandOntoNewSubnetJob {
    fn execute(self) {
        if let Some((next_step, now)) =
            read_state(|state| state.data.subnets.in_progress().map(|s| (s.next_step(), state.env.now())))
        {
            ic_cdk::spawn(self.process_step(next_step, now));
        }
    }
}

impl ExpandOntoNewSubnetJob {
    async fn process_step(self, next_step: ExpandOntoNewSubnetStep, now: TimestampMillis) {
        ic_cdk::println!("Expanding onto new subnet. Step: {next_step:?}");

        let delay = match self.process_step_inner(next_step, now).await {
            Ok(Some(false)) => 0,
            Err(error) => {
                ic_cdk::println!("{error:?}");
                MINUTE_IN_MS
            }
            Ok(Some(true)) | Ok(None) => return,
        };

        mutate_state(|state| {
            let now = state.env.now();
            state
                .data
                .timer_jobs
                .enqueue_job(TimerJob::ExpandOntoNewSubnet(self), now + delay, now);
        })
    }

    async fn process_step_inner(&self, next_step: ExpandOntoNewSubnetStep, now: TimestampMillis) -> CallResult<Option<bool>> {
        let complete = match next_step {
            ExpandOntoNewSubnetStep::CreateLocalUserIndex => {
                let canister_id = create_canister(
                    self.ledger,
                    self.cmc,
                    self.subnet_id,
                    self.this_canister_id,
                    self.create_canister_block_index,
                    now,
                )
                .await?;

                mutate_state(|state| {
                    state
                        .data
                        .subnets
                        .update_in_progress(|s| s.local_user_index = Some(canister_id), now)
                })
            }
            ExpandOntoNewSubnetStep::CreateLocalGroupIndex => {
                let canister_id = create_canister(
                    self.ledger,
                    self.cmc,
                    self.subnet_id,
                    self.this_canister_id,
                    self.create_canister_block_index,
                    now,
                )
                .await?;

                mutate_state(|state| {
                    state
                        .data
                        .subnets
                        .update_in_progress(|s| s.local_group_index = Some(canister_id), now)
                })
            }
            ExpandOntoNewSubnetStep::CreateNotificationsCanister => {
                let canister_id = create_canister(
                    self.ledger,
                    self.cmc,
                    self.subnet_id,
                    self.this_canister_id,
                    self.create_canister_block_index,
                    now,
                )
                .await?;

                mutate_state(|state| {
                    state
                        .data
                        .subnets
                        .update_in_progress(|s| s.notifications_canister = Some(canister_id), now)
                })
            }
            ExpandOntoNewSubnetStep::UpdateControllers(ids) => {
                let futures: Vec<_> = [
                    (ids.local_user_index, self.user_index),
                    (ids.local_group_index, self.group_index),
                    (ids.notifications_canister, self.notifications_index),
                ]
                .into_iter()
                .map(|(canister_id, controller)| async move {
                    ic_cdk::api::management_canister::main::update_settings(UpdateSettingsArgument {
                        canister_id,
                        settings: CanisterSettings {
                            controllers: Some(vec![controller]),
                            ..Default::default()
                        },
                    })
                    .await
                })
                .collect();

                futures::future::try_join_all(futures).await?;
                mutate_state(|state| state.data.subnets.update_in_progress(|s| s.controllers_updated = true, now))
            }
            ExpandOntoNewSubnetStep::NotifyCyclesDispenser(ids) => {
                let futures: Vec<_> = [ids.local_user_index, ids.local_group_index, ids.notifications_canister]
                    .into_iter()
                    .map(|canister_id| async move {
                        cycles_dispenser_canister_c2c_client::add_canister(
                            self.cycles_dispenser,
                            &cycles_dispenser_canister::add_canister::Args { canister_id },
                        )
                        .await
                    })
                    .collect();

                futures::future::try_join_all(futures).await?;
                mutate_state(|state| state.data.subnets.update_in_progress(|s| s.event_relay_notified = true, now))
            }
            ExpandOntoNewSubnetStep::NotifyEventRelay(ids) => {
                event_relay_canister_c2c_client::authorize_principals(
                    self.event_relay,
                    &event_relay_canister::authorize_principals::Args {
                        principals: vec![ids.local_user_index, ids.local_group_index, ids.notifications_canister],
                    },
                )
                .await?;

                mutate_state(|state| state.data.subnets.update_in_progress(|s| s.event_relay_notified = true, now))
            }
            ExpandOntoNewSubnetStep::NotifyNotificationsIndex(ids) => {
                notifications_index_canister_c2c_client::add_notifications_canister(
                    self.notifications_index,
                    &notifications_index_canister::add_notifications_canister::Args {
                        canister_id: ids.notifications_canister,
                        authorizers: vec![ids.local_user_index, ids.local_group_index],
                    },
                )
                .await?;

                mutate_state(|state| {
                    state
                        .data
                        .subnets
                        .update_in_progress(|s| s.notifications_index_notified = true, now)
                })
            }
            ExpandOntoNewSubnetStep::NotifyUserIndex(ids) => {
                user_index_canister_c2c_client::add_local_user_index_canister(
                    self.user_index,
                    &user_index_canister::add_local_user_index_canister::Args {
                        canister_id: ids.local_user_index,
                        notifications_canister_id: ids.notifications_canister,
                    },
                )
                .await?;

                mutate_state(|state| {
                    state
                        .data
                        .subnets
                        .update_in_progress(|s| s.local_user_index_notified = true, now)
                })
            }
            ExpandOntoNewSubnetStep::NotifyGroupIndex(ids) => {
                group_index_canister_c2c_client::add_local_group_index_canister(
                    self.group_index,
                    &group_index_canister::add_local_group_index_canister::Args {
                        canister_id: ids.local_user_index,
                        local_user_index_canister_id: ids.local_user_index,
                        notifications_canister_id: ids.notifications_canister,
                    },
                )
                .await?;

                mutate_state(|state| {
                    state
                        .data
                        .subnets
                        .update_in_progress(|s| s.local_group_index_notified = true, now)
                })
            }
            ExpandOntoNewSubnetStep::Complete => Some(true),
        };

        Ok(complete)
    }
}

async fn create_canister(
    ledger: CanisterId,
    cmc: CanisterId,
    subnet: Principal,
    this_canister_id: Principal,
    create_canister_block_index: Option<u64>,
    now: TimestampMillis,
) -> CallResult<CanisterId> {
    let block_index = match create_canister_block_index {
        Some(index) => index,
        None => {
            match icp_ledger_canister_c2c_client::transfer(
                ledger,
                &TransferArgs {
                    memo: MEMO_CREATE_CANISTER,
                    amount: Tokens::from_e8s(100_000_000), // 1 ICP
                    fee: DEFAULT_FEE,
                    from_subaccount: None,
                    to: AccountIdentifier::new(&cmc, &Subaccount::from(this_canister_id)),
                    created_at_time: Some(Timestamp {
                        timestamp_nanos: now * NANOS_PER_MILLISECOND,
                    }),
                },
            )
            .await?
            {
                Ok(index) => index,
                Err(error) => {
                    return Err((RejectionCode::Unknown, format!("{error:?}")));
                }
            }
        }
    };

    cycles_minting_canister_c2c_client::notify_create_canister(
        cmc,
        &cycles_minting_canister::notify_create_canister::Args {
            block_index,
            controller: this_canister_id,
            subnet_selection: Some(SubnetSelection::Subnet(Subnet { subnet })),
        },
    )
    .await?
    .map_err(|error| (RejectionCode::Unknown, format!("{error:?}")))
}
