use crate::{RuntimeState, read_state};
use candid::Principal;
use ic_cdk::inspect_message;

#[inspect_message]
fn inspect_message() {
    read_state(accept_if_valid);
}

// Only accepts ingress messages which could succeed, so that nobody else can make the canister pay
// for update calls which will be rejected: those from its users, and the video call operators
// starting and ending calls. As in the User canister, whose owner is the only user it accepts calls
// from.
fn accept_if_valid(state: &RuntimeState) {
    let method_name = ic_cdk::api::msg_method_name()
        .trim_end_matches("_msgpack")
        .trim_end_matches("_v2")
        .to_string();

    let is_c2c_method = method_name.starts_with("c2c") || method_name == "wallet_receive";
    if is_c2c_method {
        // Calls from other canisters don't pass through 'inspect_message', and ingress messages
        // only come from self-authenticating principals or the anonymous one, so this only lets
        // through the tests which impersonate a canister
        if !can_send_ingress(state.env.caller()) {
            ic_cdk::api::accept_message();
        }
        return;
    }

    if state.caller_user_index().is_some()
        || ((method_name == "start_video_call" || method_name == "end_video_call") && state.is_caller_video_call_operator())
    {
        ic_cdk::api::accept_message();
    }
}

// Whether the principal is one which can sign an ingress message: a self-authenticating principal,
// which is 29 bytes ending in the 0x02 class tag, or the anonymous principal
fn can_send_ingress(principal: Principal) -> bool {
    let bytes = principal.as_slice();
    principal == Principal::anonymous() || (bytes.len() == 29 && bytes[28] == 0x02)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_self_authenticating_and_anonymous_principals_can_send_ingress() {
        assert!(can_send_ingress(Principal::self_authenticating([1, 2, 3])));
        assert!(can_send_ingress(Principal::anonymous()));
        assert!(!can_send_ingress(Principal::from_text("rrkah-fqaaa-aaaaa-aaaaq-cai").unwrap()));
        assert!(!can_send_ingress(Principal::from_slice(&[1, 2, 3, 4, 5, 6, 7, 8])));
    }
}
