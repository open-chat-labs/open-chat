use ic_cdk::api::stable;
use ic_cdk::export::candid;
use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use serde::de::DeserializeOwned;
use std::mem;

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
    let (saved,): (T::State,) = stable_restore_hack().unwrap();

    T::fill(saved)
}

// This is exactly the same as the 'stable_restore' method in the cdk except we skip the 'de.done()' check
pub fn stable_restore_hack<T>() -> Result<T, String>
where
    T: for<'de> candid::de::ArgumentDecoder<'de>,
{
    let bytes = stable::stable_bytes();

    let mut de =
        candid::de::IDLDeserialize::new(bytes.as_slice()).map_err(|e| format!("{:?}", e))?;
    let res = candid::de::ArgumentDecoder::decode(&mut de).map_err(|e| format!("{:?}", e))?;
    // The idea here is to ignore an error that comes from Candid, because we have trailing
    // bytes.
    // let _ = de.done();
    Ok(res)
}

pub trait StableState: 'static + Default {
    type State: CandidType + DeserializeOwned;
    fn drain(self) -> Self::State;
    fn fill(source: Self::State) -> Self;
}
