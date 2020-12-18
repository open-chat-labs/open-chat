use std::mem;
use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use serde::de::DeserializeOwned;

pub fn pre_upgrade<T: StableState>() {    
    let from_storage: &mut T = storage::get_mut();
    
    let val = mem::take(from_storage);

    let to_save = val.drain();

    storage::stable_save((to_save,)).unwrap();
}

pub fn post_upgrade<T: StableState>() {
    let (saved,) = storage::stable_restore().unwrap();

    let val = T::fill(saved);
    
    let from_storage: &mut T = storage::get_mut();

    *from_storage = val;
}

pub trait StableState: 'static + Default {
    type State: CandidType + DeserializeOwned;
    fn drain(self) -> Self::State;
    fn fill(source: Self::State) -> Self;
}