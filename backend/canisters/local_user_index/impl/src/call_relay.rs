use candid::CandidType;
use ic_cdk::call::RejectCode;
use serde::Deserialize;
use types::{C2CError, CanisterId};

// A tiny canister which relays calls from its controllers, making them as itself. Installed on
// a migrated user's uninstalled canister, it lets this LocalUserIndex move the funds the canister
// holds. See backend/canisters/call_relay, which is where this wasm is built from.
pub const CALL_RELAY_WASM: &[u8] = include_bytes!("../../../call_relay/call_relay.wasm");

// Calls `method` on `callee` as `canister_id`, which has the call relay installed
pub async fn call<A: CandidType, R: CandidType + for<'de> Deserialize<'de>>(
    canister_id: CanisterId,
    callee: CanisterId,
    method: &str,
    args: &A,
    timeout_seconds: u32,
) -> Result<R, C2CError> {
    let payload = encode_args(callee, method, &candid::encode_one(args).unwrap());
    let reply = canister_client::make_c2c_call_raw(canister_id, "relay", &payload, 0, Some(timeout_seconds)).await?;
    let bytes = decode_reply(callee, method, &reply)?;
    candid::decode_one(bytes).map_err(|error| C2CError::new(callee, method, RejectCode::CanisterReject, error.to_string()))
}

fn encode_args(callee: CanisterId, method: &str, payload: &[u8]) -> Vec<u8> {
    let callee = callee.as_slice();
    let mut args = Vec::with_capacity(2 + callee.len() + method.len() + payload.len());
    args.push(callee.len() as u8);
    args.extend_from_slice(callee);
    args.push(u8::try_from(method.len()).expect("Method name too long to relay"));
    args.extend_from_slice(method.as_bytes());
    args.extend_from_slice(payload);
    args
}

// The relay replies with the callee's reject code, which is 0 if the callee replied, followed by
// its reply or reject message
fn decode_reply<'a>(callee: CanisterId, method: &str, reply: &'a [u8]) -> Result<&'a [u8], C2CError> {
    let Some((reject_code, rest)) = reply.split_first_chunk::<4>() else {
        return Err(C2CError::new(
            callee,
            method,
            RejectCode::CanisterReject,
            "Invalid reply from the call relay".to_string(),
        ));
    };
    match u32::from_le_bytes(*reject_code) {
        0 => Ok(rest),
        code => Err(C2CError::new(
            callee,
            method,
            RejectCode::try_from(u64::from(code)).unwrap_or(RejectCode::SysUnknown),
            String::from_utf8_lossy(rest).into_owned(),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;

    #[test]
    fn args_are_the_callee_then_the_method_then_the_payload_each_prefixed_by_its_length() {
        let callee = Principal::from_slice(&[1, 2, 3]);

        assert_eq!(
            encode_args(callee, "abc", &[9, 9]),
            vec![3, 1, 2, 3, 3, b'a', b'b', b'c', 9, 9]
        );
        assert_eq!(encode_args(Principal::management_canister(), "x", &[]), vec![0, 1, b'x']);
    }

    #[test]
    fn reply_is_returned_if_the_callee_replied() {
        let reply = [0, 0, 0, 0, 7, 8];

        assert_eq!(decode_reply(Principal::anonymous(), "m", &reply).unwrap(), &[7, 8]);
    }

    #[test]
    fn reject_is_returned_as_an_error() {
        let reply = [[5, 0, 0, 0].as_slice(), b"boom"].concat();

        let error = decode_reply(Principal::anonymous(), "m", &reply).unwrap_err();

        assert_eq!(error.reject_code(), RejectCode::CanisterError);
        assert_eq!(error.message(), "boom");
        assert_eq!(error.method_name(), "m");
    }

    #[test]
    fn reply_too_short_to_hold_a_reject_code_is_an_error() {
        assert!(decode_reply(Principal::anonymous(), "m", &[0, 0, 0]).is_err());
    }
}
