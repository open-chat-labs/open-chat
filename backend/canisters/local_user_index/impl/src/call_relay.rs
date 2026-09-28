use ic_cdk::call::RejectCode;
use std::cell::RefCell;
use std::collections::HashSet;
use types::{C2CError, CanisterId, CanisterWasmBytes};

// A tiny canister which relays calls from its controllers, making them as itself. Installed on
// a migrated user's uninstalled canister, it lets this LocalUserIndex move the funds the canister
// holds. See backend/canisters/call_relay, which is where this wasm is built from.
const CALL_RELAY_WASM: &[u8] = include_bytes!("../../../call_relay/call_relay.wasm");

thread_local! {
    // The canisters reserved for the relay's use, which the cycles refund job leaves alone
    static IN_USE: RefCell<HashSet<CanisterId>> = RefCell::default();
}

pub fn wasm() -> CanisterWasmBytes {
    CanisterWasmBytes(CALL_RELAY_WASM.to_vec())
}

pub fn is_in_use(canister_id: CanisterId) -> bool {
    IN_USE.with_borrow(|c| c.contains(&canister_id))
}

// Reserves the canister for the relay's use while held. Being on the heap, reservations are
// cleared by an upgrade, but the canister is stopped first, so none are held at the time.
pub struct InUseGuard(CanisterId);

impl InUseGuard {
    // None if the canister is already reserved
    pub fn new(canister_id: CanisterId) -> Option<InUseGuard> {
        IN_USE
            .with_borrow_mut(|c| c.insert(canister_id))
            .then_some(InUseGuard(canister_id))
    }
}

impl Drop for InUseGuard {
    fn drop(&mut self) {
        IN_USE.with_borrow_mut(|c| c.remove(&self.0));
    }
}

// Calls `method` on `callee` with `payload` as `canister_id`, which has the relay installed,
// returning the callee's reply
pub async fn call(
    canister_id: CanisterId,
    callee: CanisterId,
    method: &str,
    payload: &[u8],
    timeout_seconds: u32,
) -> Result<Vec<u8>, C2CError> {
    let args = encode_args(callee, method, payload);
    let reply = canister_client::make_c2c_call_raw(canister_id, "relay", &args, 0, Some(timeout_seconds)).await?;
    decode_reply(callee, method, &reply).map(|bytes| bytes.to_vec())
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
