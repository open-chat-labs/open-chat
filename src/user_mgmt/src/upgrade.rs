use ic_cdk_macros::*;
use crate::domain::user_data::UserData;

#[pre_upgrade]
fn pre_upgrade() {
    shared::pre_upgrade::<UserData>();
}

#[post_upgrade]
fn post_upgrade() {
    shared::post_upgrade::<UserData>();
}