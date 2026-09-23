use crate::canister::convert_cdk_error;
use candid::{CandidType, Nat, Principal};
use ic_cdk::call::{Call, CallResult};
use ic_cdk_management_canister::{CanisterStatusArgs, CanisterStatusType};
use serde::Deserialize;
use types::{C2CError, CanisterId};

// A minimal version of the management canister's `canister_status` response, listing only the
// fields we use. Decoding into a subset keeps us compatible with replicas both older and newer
// than the ic-management-canister-types version in use: candid width subtyping ignores any fields
// not listed here, whereas decoding the full `CanisterStatusResult` fails against a replica which
// does not yet return every field (eg. the PocketIC version used by the integration tests predates
// `ready_for_migration`).
#[derive(CandidType, Deserialize, Debug)]
pub struct CanisterStatusMinimal {
    pub status: CanisterStatusType,
    pub settings: CanisterSettingsMinimal,
    pub module_hash: Option<Vec<u8>>,
    pub cycles: Nat,
    pub idle_cycles_burned_per_day: Nat,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct CanisterSettingsMinimal {
    pub controllers: Vec<Principal>,
    // In seconds
    pub freezing_threshold: Nat,
}

impl CanisterStatusMinimal {
    pub fn cycles(&self) -> u128 {
        nat_to_u128(&self.cycles)
    }

    // The balance below which the canister is frozen, which it can't spend
    pub fn freezing_threshold_cycles(&self) -> u128 {
        nat_to_u128(&self.idle_cycles_burned_per_day) * nat_to_u128(&self.settings.freezing_threshold) / (24 * 60 * 60)
    }
}

fn nat_to_u128(nat: &Nat) -> u128 {
    u128::try_from(nat.0.clone()).unwrap_or(u128::MAX)
}

pub async fn canister_status(canister_id: CanisterId) -> Result<CanisterStatusMinimal, C2CError> {
    inner(canister_id)
        .await
        .map_err(|e| convert_cdk_error(canister_id, "canister_status", e))
}

async fn inner(canister_id: CanisterId) -> CallResult<CanisterStatusMinimal> {
    Ok(Call::bounded_wait(Principal::management_canister(), "canister_status")
        .with_arg(&CanisterStatusArgs { canister_id })
        .await?
        .candid()?)
}
