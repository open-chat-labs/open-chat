use crate::model::private_groups::PrivateGroups;
use crate::model::public_groups::PublicGroups;
use shared::canisters::canister_wasm::CanisterWasm;

#[derive(Default)]
pub struct Data {
    pub public_groups: PublicGroups,
    pub private_groups: PrivateGroups,
    pub group_canister_wasm: CanisterWasm,
}
