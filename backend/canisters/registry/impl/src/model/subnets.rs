use candid::Principal;
use registry_canister::subnets::Subnet;
use serde::{Deserialize, Serialize};
use tracing::info;
use types::{CanisterId, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
pub struct Subnets {
    subnets: Vec<Subnet>,
    in_progress: Option<SubnetInProgress>,
}

impl Subnets {
    pub fn subnets(&self) -> &[Subnet] {
        &self.subnets
    }

    pub fn start_new(&mut self, subnet_id: Principal, now: TimestampMillis) {
        self.in_progress = Some(SubnetInProgress::new(subnet_id, now));
    }

    pub fn in_progress(&self) -> Option<&SubnetInProgress> {
        self.in_progress.as_ref()
    }

    pub fn update_in_progress<F: FnOnce(&mut SubnetInProgress)>(&mut self, f: F, now: TimestampMillis) -> Option<bool> {
        let mut subnet = self.in_progress.take()?;
        f(&mut subnet);
        subnet.last_updated = now;

        let complete = subnet.is_complete();
        if complete {
            let subnet_id = subnet.id;
            self.subnets.push(subnet.try_into().unwrap());
            self.in_progress = None;
            info!(%subnet_id, "Subnet added");
        } else {
            self.in_progress = Some(subnet);
        }
        Some(complete)
    }
}

#[derive(Serialize, Deserialize)]
pub struct SubnetInProgress {
    pub id: Principal,
    pub local_user_index: Option<CanisterId>,
    pub local_group_index: Option<CanisterId>,
    pub notifications_canister: Option<CanisterId>,
    pub controllers_updated: bool,
    pub event_relay_notified: bool,
    pub notifications_index_notified: bool,
    pub local_user_index_notified: bool,
    pub local_group_index_notified: bool,
    pub create_canister_block_index: Option<u64>,
    last_updated: TimestampMillis,
}

impl SubnetInProgress {
    pub fn new(id: Principal, now: TimestampMillis) -> Self {
        SubnetInProgress {
            id,
            last_updated: now,
            local_user_index: None,
            local_group_index: None,
            notifications_canister: None,
            controllers_updated: false,
            event_relay_notified: false,
            notifications_index_notified: false,
            local_user_index_notified: false,
            local_group_index_notified: false,
            create_canister_block_index: None,
        }
    }

    pub fn next_step(&self) -> ExpandOntoNewSubnetStep {
        let Some(local_user_index) = self.local_user_index else {
            return ExpandOntoNewSubnetStep::CreateLocalUserIndex;
        };
        let Some(local_group_index) = self.local_group_index else {
            return ExpandOntoNewSubnetStep::CreateLocalGroupIndex;
        };
        let Some(notifications_canister) = self.notifications_canister else {
            return ExpandOntoNewSubnetStep::CreateNotificationsCanister;
        };

        let new_canister_ids = NewCanisterIds {
            local_user_index,
            local_group_index,
            notifications_canister,
        };
        if !self.controllers_updated {
            ExpandOntoNewSubnetStep::UpdateControllers(new_canister_ids)
        } else if !self.event_relay_notified {
            ExpandOntoNewSubnetStep::NotifyEventRelay(new_canister_ids)
        } else if !self.notifications_index_notified {
            ExpandOntoNewSubnetStep::NotifyNotificationsIndex(new_canister_ids)
        } else if !self.local_user_index_notified {
            ExpandOntoNewSubnetStep::NotifyUserIndex(new_canister_ids)
        } else if !self.local_group_index_notified {
            ExpandOntoNewSubnetStep::NotifyGroupIndex(new_canister_ids)
        } else {
            ExpandOntoNewSubnetStep::Complete
        }
    }

    pub fn is_complete(&self) -> bool {
        matches!(self.next_step(), ExpandOntoNewSubnetStep::Complete)
    }
}

impl TryFrom<SubnetInProgress> for Subnet {
    type Error = ();

    fn try_from(value: SubnetInProgress) -> Result<Self, Self::Error> {
        let (local_user_index, local_group_index, notifications_canister) =
            match (value.local_user_index, value.local_group_index, value.notifications_canister) {
                (Some(local_user_index), Some(local_group_index), Some(notifications_canister)) => {
                    (local_user_index, local_group_index, notifications_canister)
                }
                _ => return Err(()),
            };

        Ok(Subnet {
            subnet_id: value.id,
            local_user_index,
            local_group_index,
            notifications_canister,
        })
    }
}

#[derive(Debug)]
pub struct NewCanisterIds {
    pub local_user_index: CanisterId,
    pub local_group_index: CanisterId,
    pub notifications_canister: CanisterId,
}

#[derive(Debug)]
pub enum ExpandOntoNewSubnetStep {
    CreateLocalUserIndex,
    CreateLocalGroupIndex,
    CreateNotificationsCanister,
    UpdateControllers(NewCanisterIds),
    NotifyCyclesDispenser(NewCanisterIds),
    NotifyEventRelay(NewCanisterIds),
    NotifyNotificationsIndex(NewCanisterIds),
    NotifyUserIndex(NewCanisterIds),
    NotifyGroupIndex(NewCanisterIds),
    Complete,
}
