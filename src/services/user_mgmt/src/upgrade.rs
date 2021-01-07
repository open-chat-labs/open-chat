use ic_cdk_macros::*;
use shared::upgrade;
use crate::domain::user_store::UserStore;

#[pre_upgrade]
fn pre_upgrade() {
    upgrade::pre_upgrade::<UserStore>();
}

#[post_upgrade]
fn post_upgrade() {
    upgrade::post_upgrade::<UserStore>();
}