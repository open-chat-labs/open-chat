use ic_cdk_macros::*;
use shared::upgrade;
use crate::domain::chat_list::ChatList;
use crate::domain::blob_storage::BlobStorage;

#[pre_upgrade]
fn pre_upgrade() {
    upgrade::pre_upgrade::<ChatList>();
    upgrade::pre_upgrade::<BlobStorage>();
}

#[post_upgrade]
fn post_upgrade() {
    upgrade::post_upgrade::<ChatList>();
    upgrade::post_upgrade::<BlobStorage>();
}