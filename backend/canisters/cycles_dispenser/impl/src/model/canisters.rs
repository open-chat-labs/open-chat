use candid::CandidType;
use serde::{Deserialize, Serialize};
use std::collections::hash_map::Entry::Vacant;
use std::collections::HashMap;
use types::{CanisterId, Cycles, TimestampMillis};

#[derive(Serialize, Deserialize)]
pub struct Canisters {
    canisters: HashMap<CanisterId, Canister>,
}

impl Canisters {
    pub fn new(canister_ids: Vec<CanisterId>, now: TimestampMillis) -> Canisters {
        Canisters {
            canisters: canister_ids
                .into_iter()
                .map(|c| {
                    (
                        c,
                        Canister {
                            added: now,
                            top_ups: Vec::new(),
                            top_up_in_progress: false,
                        },
                    )
                })
                .collect(),
        }
    }

    pub fn add(&mut self, canister_id: CanisterId, now: TimestampMillis) -> bool {
        if let Vacant(e) = self.canisters.entry(canister_id) {
            e.insert(Canister {
                added: now,
                top_ups: Vec::new(),
                top_up_in_progress: false,
            });
            true
        } else {
            false
        }
    }

    pub fn get_mut(&mut self, canister_id: &CanisterId) -> Option<&mut Canister> {
        self.canisters.get_mut(canister_id)
    }

    pub fn metrics(&self) -> Vec<CanisterMetrics> {
        self.canisters
            .iter()
            .map(|(id, c)| CanisterMetrics {
                canister_id: *id,
                added: c.added,
                top_ups: c.top_ups.clone(),
            })
            .collect()
    }
}

#[derive(Serialize, Deserialize)]
pub struct Canister {
    added: TimestampMillis,
    top_ups: Vec<CyclesTopUp>,
    top_up_in_progress: bool,
}

impl Canister {
    pub fn top_up_in_progress(&self) -> bool {
        self.top_up_in_progress
    }

    pub fn set_top_up_in_progress(&mut self, in_progress: bool) {
        self.top_up_in_progress = in_progress;
    }

    pub fn latest_top_up(&self) -> Option<TimestampMillis> {
        self.top_ups.last().map(|t| t.date)
    }

    pub fn record_top_up(&mut self, amount: Cycles, now: TimestampMillis) {
        self.top_ups.push(CyclesTopUp { date: now, amount });
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
struct CyclesTopUp {
    pub date: TimestampMillis,
    pub amount: Cycles,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct CanisterMetrics {
    canister_id: CanisterId,
    added: TimestampMillis,
    top_ups: Vec<CyclesTopUp>,
}
