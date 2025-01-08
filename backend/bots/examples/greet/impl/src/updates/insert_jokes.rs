use crate::state;
use bot_utils::env;
use greet_bot_canister::insert_jokes::{Args, Response};
use ic_cdk::update;

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
