use self::Response::*;
use crate::domain::user_store::UserStore;
use ic_cdk::export::candid::CandidType;
use ic_cdk::storage;
use shared::timestamp;

pub fn update(image_id: String) -> Response {
    let me = shared::user_id::get_current();
    let now = timestamp::now();

    let user_store: &mut UserStore = storage::get_mut();

    match user_store.set_profile_image(&me, image_id, now) {
        false => UserNotFound,
        true => Success,
    }
}

#[derive(CandidType)]
pub enum Response {
    Success,
    UserNotFound,
}
