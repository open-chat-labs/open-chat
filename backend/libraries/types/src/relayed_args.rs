use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct RelayedArgs<T> {
    pub caller: Principal,
    pub args: T,
}
