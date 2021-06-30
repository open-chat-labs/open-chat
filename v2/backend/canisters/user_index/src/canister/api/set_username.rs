use candid::CandidType;
use crate::canister::RUNTIME_STATE;
use crate::data::set_username::Result;
use crate::runtime_state::RuntimeState;
use ic_cdk_macros::update;
use serde::Deserialize;

const MAX_USERNAME_LENGTH: u16 = 25;
const MIN_USERNAME_LENGTH: u16 = 2;

#[update]
fn set_username(request: Request) -> Response {
    RUNTIME_STATE.with(|state| {
        set_username_impl(request, state.borrow_mut().as_mut().unwrap())
    })
}

fn set_username_impl(request: Request, runtime_state: &mut RuntimeState) -> Response {
    let username = request.username;
    
    if username.len() > MAX_USERNAME_LENGTH as usize {
        return Response::UsernameTooLong(MAX_USERNAME_LENGTH);
    }

    if username.len() < MIN_USERNAME_LENGTH as usize {
        return Response::UsernameTooShort(MIN_USERNAME_LENGTH);
    }

    let set_username_request = crate::data::set_username::Request {
        caller: runtime_state.env.caller(),
        username,
        now: runtime_state.env.now()                
    };

    match runtime_state.data.set_username(set_username_request) {
        Result::Success => Response::Success,
        Result::UserUnconfirmed => Response::UserUnconfirmed,
        Result::UsernameTaken => Response::UsernameTaken,
        Result::UserNotFound => Response::UserNotFound,
    }
}

#[derive(Deserialize)]
pub struct Request {
    username: String
}

#[derive(CandidType)]
pub enum Response {
    Success,
    UsernameTaken,
    UserUnconfirmed,
    UserNotFound,
    UsernameInvalid,
    UsernameTooShort(u16),
    UsernameTooLong(u16),
}
