use crate::domain::user_store::UserStore;
use ic_cdk_macros::*;
use shared::storage;

#[pre_upgrade]
fn pre_upgrade() {
    storage::stable_save::<UserStore>(storage::take_from_storage());
}

#[post_upgrade]
fn post_upgrade() {
    storage::put_in_storage(storage::stable_restore::<UserStore>());
}
