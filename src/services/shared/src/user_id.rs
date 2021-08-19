use ic_cdk::export::candid::Principal;

pub type UserId = Principal;

pub fn get_current() -> UserId {
    ic_cdk::caller()
}
