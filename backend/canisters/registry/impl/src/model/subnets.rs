use candid::Principal;
use registry_canister::subnets::Subnet;
use serde::{Deserialize, Serialize};
use tracing::info;
use types::{CanisterId, TimestampMillis};

#[derive(Serialize, Deserialize, Default)]
pub struct Subnets {
    pub subnets: Vec<Subnet>,
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
    pub local_index: Option<CanisterId>,
    pub controllers_updated: bool,
    pub cycles_dispenser_notified: bool,
    pub event_relay_notified: bool,
    pub notifications_index_notified: bool,
    pub user_index_notified: bool,
    pub group_index_notified: bool,
    pub create_canister_block_index: Option<u64>,
    last_updated: TimestampMillis,
}

impl SubnetInProgress {
    pub fn new(id: Principal, now: TimestampMillis) -> Self {
        SubnetInProgress {
            id,
            last_updated: now,
            local_index: None,
            controllers_updated: false,
            cycles_dispenser_notified: false,
            event_relay_notified: false,
            notifications_index_notified: false,
            user_index_notified: false,
            group_index_notified: false,
            create_canister_block_index: None,
        }
    }

    pub fn next_step(&self) -> ExpandOntoSubnetStep {
        let Some(local_index) = self.local_index else {
            return ExpandOntoSubnetStep::CreateLocalIndex;
        };

        if !self.controllers_updated {
            ExpandOntoSubnetStep::UpdateControllers(local_index)
        } else if !self.cycles_dispenser_notified {
            ExpandOntoSubnetStep::NotifyCyclesDispenser(local_index)
        } else if !self.event_relay_notified {
            ExpandOntoSubnetStep::NotifyEventRelay(local_index)
        } else if !self.user_index_notified {
            ExpandOntoSubnetStep::NotifyUserIndex(local_index)
        } else if !self.group_index_notified {
            ExpandOntoSubnetStep::NotifyGroupIndex(local_index)
        } else if !self.notifications_index_notified {
            ExpandOntoSubnetStep::NotifyNotificationsIndex(local_index)
        } else {
            ExpandOntoSubnetStep::Complete
        }
    }

    pub fn is_complete(&self) -> bool {
        matches!(self.next_step(), ExpandOntoSubnetStep::Complete)
    }
}

impl TryFrom<SubnetInProgress> for Subnet {
    type Error = ();

    fn try_from(value: SubnetInProgress) -> Result<Self, Self::Error> {
        if let Some(local_user_index) = value.local_index {
            Ok(Subnet {
                subnet_id: value.id,
                local_user_index,
            })
        } else {
            Err(())
        }
    }
}

#[derive(Debug)]
pub enum ExpandOntoSubnetStep {
    CreateLocalIndex,
    UpdateControllers(CanisterId),
    NotifyCyclesDispenser(CanisterId),
    NotifyEventRelay(CanisterId),
    NotifyUserIndex(CanisterId),
    NotifyGroupIndex(CanisterId),
    NotifyNotificationsIndex(CanisterId),
    Complete,
}
