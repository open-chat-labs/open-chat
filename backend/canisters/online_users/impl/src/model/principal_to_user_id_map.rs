use crate::memory::get_principal_to_user_id_map_memory;
use candid::Principal;
use ic_stable_structures::StableBTreeMap;
use serde::{Deserialize, Serialize};
use stable_memory::Memory;
use types::UserId;

#[derive(Serialize, Deserialize)]
pub struct PrincipalToUserIdMap {
    #[serde(skip, default = "init_map")]
    map: StableBTreeMap<Principal, Principal, Memory>,
}

impl PrincipalToUserIdMap {
    pub fn add(&mut self, principal: Principal, user_id: UserId) {
        self.map.insert(principal, user_id.into());
    }

    pub fn get(&self, principal: &Principal) -> Option<UserId> {
        self.map.get(principal).map(|u| u.into())
    }
}

fn init_map() -> StableBTreeMap<Principal, Principal, Memory> {
    let memory = get_principal_to_user_id_map_memory();

    StableBTreeMap::init(memory)
}

impl Default for PrincipalToUserIdMap {
    fn default() -> Self {
        PrincipalToUserIdMap { map: init_map() }
    }
}
