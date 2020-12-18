use ic_cdk_macros::*;
use crate::domain::chat_list::ChatList;

#[pre_upgrade]
fn pre_upgrade() {
    shared::pre_upgrade::<ChatList>();
}

#[post_upgrade]
fn post_upgrade() {
    shared::post_upgrade::<ChatList>();
}