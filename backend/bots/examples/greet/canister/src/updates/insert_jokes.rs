use ic_cdk::update;
use oc_bots_sdk_canister::env;

use crate::{
    api::insert_jokes::{Args, Response},
    state,
};

#[update]
fn insert_jokes(args: Args) -> Response {
    state::mutate(|state| {
        if *state.administrator() != env::caller() {
            Response::NotAuthorized
        } else {
            Response::Success(state.insert_jokes(args.jokes))
        }
    })
}
