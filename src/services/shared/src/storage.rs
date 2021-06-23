use std::mem;
use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use serde::de::DeserializeOwned;

pub fn take_from_storage<T: 'static + Default>() -> T {
    let from_storage: &mut T = storage::get_mut();

    mem::take(from_storage)
}

pub fn put_in_storage<T: 'static + Default>(value: T) {
    let from_storage: &mut T = storage::get_mut();

    *from_storage = value;
}

pub fn stable_save<T: StableState>(value: T) {
    let to_save = value.drain();

    storage::stable_save((to_save,)).unwrap();
}

pub fn stable_restore<T: StableState>() -> T {
    let (saved,) : (T::State,) = storage::stable_restore().unwrap();

    T::fill(saved)
}

pub trait StableState: 'static + Default {
    type State: CandidType + DeserializeOwned;
    fn drain(self) -> Self::State;
    fn fill(source: Self::State) -> Self;
}
