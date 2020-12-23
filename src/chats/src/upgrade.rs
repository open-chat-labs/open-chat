use ic_cdk_macros::*;
use shared::upgrade;
use crate::domain::chat_list::ChatList;

#[pre_upgrade]
fn pre_upgrade() {
    upgrade::pre_upgrade::<ChatList>();
}

#[post_upgrade]
fn post_upgrade() {
    upgrade::post_upgrade::<ChatList>();
}