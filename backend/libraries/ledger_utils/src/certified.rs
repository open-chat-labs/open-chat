use candid::{Nat, Principal};
use constants::{MINUTE_IN_MS, NANOS_PER_MILLISECOND};
use ic_cbor::CertificateToCbor;
use ic_certificate_verification::VerifyCertificate;
use ic_certification::{Certificate, LookupResult};
use ic_representation_independent_hash::{Value, representation_independent_hash};
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
use oc_error_codes::{OCError, OCErrorCode};
use types::certified::{CertifiedCall, PendingCryptoTransaction};
use types::icrc1::{Account, CompletedCryptoTransaction};
use types::{CanisterId, TimestampMillis};

const TRANSFER_METHOD_NAME: &str = "icrc1_transfer";

// How far the certificate's time may be from now. The client reads the certificate as soon as the
// ledger replies, so this only needs to allow for the time taken to pass it on. A block index needs
// remembering for this long after the certificate's time to stop the transfer being used twice.
pub const MAX_CERTIFICATE_TIME_OFFSET: TimestampMillis = 5 * MINUTE_IN_MS;

// Checks the certificate proves the ledger replied to the `sender`'s call to `icrc1_transfer`
// with a block index, and that the transfer is the one described by `transaction`. The memo must
// be `required_memo`, so that a transfer made for one canister can't be used in another. It is
// left to the caller to check the ledger is the one registered for the token, and to ensure each
// block index is only used once.
pub fn verify_certified_transfer(
    transaction: PendingCryptoTransaction,
    sender: Principal,
    required_memo: &[u8],
    ic_root_key: &[u8],
    now: TimestampMillis,
) -> Result<CompletedCryptoTransaction, OCError> {
    let from = verify_transfer_arg(&transaction, sender, required_memo)?;

    let request_id = request_id(sender, transaction.ledger, TRANSFER_METHOD_NAME, &transaction.call);

    let certificate = Certificate::from_cbor(&transaction.call.certificate)
        .map_err(|_| OCErrorCode::MalformedSignature.with_message("Unable to parse certificate"))?;

    certificate
        .verify(
            transaction.ledger.as_slice(),
            ic_root_key,
            &((now * NANOS_PER_MILLISECOND) as u128),
            &((MAX_CERTIFICATE_TIME_OFFSET * NANOS_PER_MILLISECOND) as u128),
        )
        .map_err(|error| OCErrorCode::InvalidSignature.with_message(error))?;

    let block_index = extract_block_index(&certificate, &request_id)?;

    Ok(CompletedCryptoTransaction {
        ledger: transaction.ledger,
        token_symbol: transaction.token_symbol,
        amount: transaction.amount,
        from: from.into(),
        to: transaction.to.into(),
        fee: transaction.fee,
        memo: transaction.memo,
        created: transaction.created,
        block_index,
    })
}

// Checks the arg of the call matches the transaction and returns the account it is from
fn verify_transfer_arg(
    transaction: &PendingCryptoTransaction,
    sender: Principal,
    required_memo: &[u8],
) -> Result<Account, OCError> {
    let arg: TransferArg = candid::decode_one(&transaction.call.arg)
        .map_err(|_| OCErrorCode::InvalidRequest.with_message("Unable to decode transfer arg"))?;

    if transaction.memo.as_ref().map(|m| m.0.as_slice()) != Some(required_memo) {
        return Err(OCErrorCode::InvalidRequest.with_message("Transfer has the wrong memo"));
    }

    let matches = arg.to == transaction.to.into()
        && arg.amount == transaction.amount
        && arg.fee == Some(Nat::from(transaction.fee))
        && arg.memo == transaction.memo
        && arg.created_at_time == Some(transaction.created);

    if !matches {
        return Err(OCErrorCode::InvalidRequest.with_message("Transfer arg does not match the transaction"));
    }

    Ok(Account {
        owner: sender,
        subaccount: arg.from_subaccount,
    })
}

// The request id of the call, as defined in the IC interface spec:
// https://internetcomputer.org/docs/references/ic-interface-spec#request-id
fn request_id(sender: Principal, canister_id: CanisterId, method_name: &str, call: &CertifiedCall) -> [u8; 32] {
    let mut fields = vec![
        ("request_type".to_string(), Value::String("call".to_string())),
        ("sender".to_string(), Value::Bytes(sender.as_slice().to_vec())),
        ("canister_id".to_string(), Value::Bytes(canister_id.as_slice().to_vec())),
        ("method_name".to_string(), Value::String(method_name.to_string())),
        ("arg".to_string(), Value::Bytes(call.arg.clone())),
        ("ingress_expiry".to_string(), Value::Number(call.ingress_expiry)),
    ];
    if let Some(nonce) = &call.nonce {
        fields.push(("nonce".to_string(), Value::Bytes(nonce.to_vec())));
    }
    representation_independent_hash(&fields)
}

fn extract_block_index(certificate: &Certificate, request_id: &[u8; 32]) -> Result<u64, OCError> {
    let lookup = |field: &str| {
        certificate
            .tree
            .lookup_path([b"request_status".as_slice(), request_id, field.as_bytes()])
    };

    let LookupResult::Found(status) = lookup("status") else {
        return Err(OCErrorCode::InvalidSignature.with_message("Certificate holds no status for the request"));
    };
    if status != b"replied" {
        return Err(
            OCErrorCode::TransferFailed.with_message(format!("Transfer status is '{}'", String::from_utf8_lossy(status)))
        );
    }

    let LookupResult::Found(reply) = lookup("reply") else {
        return Err(OCErrorCode::InvalidSignature.with_message("Certificate holds no reply for the request"));
    };

    match candid::decode_one::<Result<Nat, TransferError>>(reply) {
        Ok(Ok(block_index)) => block_index
            .0
            .try_into()
            .map_err(|_| OCErrorCode::InvalidRequest.with_message("Block index too large")),
        Ok(Err(error)) => Err(OCErrorCode::TransferFailed.with_message(format!("{error:?}"))),
        Err(_) => Err(OCErrorCode::InvalidRequest.with_message("Unable to decode transfer reply")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ic_certification::{fork, labeled, leaf};
    use ic_verify_bls_signature::PrivateKey;
    use icrc_ledger_types::icrc1::transfer::Memo;
    use serde::Serialize;
    use serde_bytes::ByteBuf;

    const NOW: TimestampMillis = 1_800_000_000_000;
    const DER_PREFIX: &[u8; 37] = b"\x30\x81\x82\x30\x1d\x06\x0d\x2b\x06\x01\x04\x01\x82\xdc\x7c\x05\x03\x01\x02\x01\x06\x0c\x2b\x06\x01\x04\x01\x82\xdc\x7c\x05\x03\x02\x01\x03\x61\x00";

    // The example given in the IC interface spec
    #[test]
    fn request_id_matches_spec_example() {
        let call = CertifiedCall {
            arg: b"DIDL\x00\xFD*".to_vec(),
            ingress_expiry: 1_685_570_400_000_000_000,
            nonce: None,
            certificate: Vec::new(),
        };
        let canister_id = CanisterId::from_slice(&[0, 0, 0, 0, 0, 0, 0x04, 0xD2]);
        assert_eq!(
            hex::encode(request_id(Principal::anonymous(), canister_id, "hello", &call)),
            "1d1091364d6bb8a6c16b203ee75467d59ead468f523eb058880ae8ec80e2b101"
        );
    }

    #[test]
    fn valid_transfer_succeeds() {
        let test = TestTransfer::new();
        let completed = test.verify().unwrap();
        assert_eq!(completed.block_index, 123);
        assert_eq!(completed.amount, test.transaction.amount);
        let types::icrc1::CryptoAccount::Account(from) = completed.from else {
            panic!()
        };
        assert_eq!(from.owner, test.sender);
        assert_eq!(from.subaccount, Some([7; 32]));
    }

    #[test]
    fn different_sender_fails() {
        let mut test = TestTransfer::new();
        test.sender = Principal::from_slice(&[9; 29]);
        assert_eq!(test.verify().unwrap_err().code(), OCErrorCode::InvalidSignature as u16);
    }

    #[test]
    fn different_ledger_fails() {
        let mut test = TestTransfer::new();
        test.transaction.ledger = CanisterId::from_slice(&[3; 10]);
        assert_eq!(test.verify().unwrap_err().code(), OCErrorCode::InvalidSignature as u16);
    }

    #[test]
    fn transaction_not_matching_arg_fails() {
        let mut test = TestTransfer::new();
        test.transaction.amount += 1;
        assert_eq!(test.verify().unwrap_err().code(), OCErrorCode::InvalidRequest as u16);
    }

    #[test]
    fn wrong_memo_fails() {
        let test = TestTransfer::new();
        let result = verify_certified_transfer(test.transaction.clone(), test.sender, b"other", &test.root_key, NOW);
        assert_eq!(result.unwrap_err().code(), OCErrorCode::InvalidRequest as u16);
    }

    #[test]
    fn changed_nonce_fails() {
        let mut test = TestTransfer::new();
        test.transaction.call.nonce = Some(ByteBuf::from(vec![2]));
        assert_eq!(test.verify().unwrap_err().code(), OCErrorCode::InvalidSignature as u16);
    }

    #[test]
    fn signed_by_wrong_key_fails() {
        let mut test = TestTransfer::new();
        test.root_key = TestTransfer::root_key(&private_key(2));
        assert_eq!(test.verify().unwrap_err().code(), OCErrorCode::InvalidSignature as u16);
    }

    #[test]
    fn old_certificate_fails() {
        let test = TestTransfer::new();
        let now = NOW + MAX_CERTIFICATE_TIME_OFFSET + 1;
        let result = verify_certified_transfer(test.transaction.clone(), test.sender, &test.memo, &test.root_key, now);
        assert_eq!(result.unwrap_err().code(), OCErrorCode::InvalidSignature as u16);
    }

    #[test]
    fn rejected_transfer_fails() {
        let test = TestTransfer::with_reply(Err(TransferError::InsufficientFunds {
            balance: Nat::from(0u32),
        }));
        assert_eq!(test.verify().unwrap_err().code(), OCErrorCode::TransferFailed as u16);
    }

    struct TestTransfer {
        transaction: PendingCryptoTransaction,
        sender: Principal,
        memo: Vec<u8>,
        root_key: Vec<u8>,
    }

    impl TestTransfer {
        fn new() -> TestTransfer {
            TestTransfer::with_reply(Ok(Nat::from(123u32)))
        }

        fn with_reply(reply: Result<Nat, TransferError>) -> TestTransfer {
            let sender = Principal::from_slice(&[1; 29]);
            let ledger = CanisterId::from_slice(&[2; 10]);
            let memo = b"verifying canister".to_vec();
            let to = Account {
                owner: Principal::from_slice(&[4; 29]),
                subaccount: None,
            };
            let arg = TransferArg {
                from_subaccount: Some([7; 32]),
                to: to.into(),
                fee: Some(Nat::from(10u32)),
                created_at_time: Some(NOW * NANOS_PER_MILLISECOND),
                memo: Some(Memo::from(memo.clone())),
                amount: Nat::from(1000u32),
            };
            let call = CertifiedCall {
                arg: candid::encode_one(&arg).unwrap(),
                ingress_expiry: (NOW + MINUTE_IN_MS) * NANOS_PER_MILLISECOND,
                nonce: Some(ByteBuf::from(vec![1])),
                certificate: Vec::new(),
            };

            let request_id = request_id(sender, ledger, TRANSFER_METHOD_NAME, &call);
            let tree = fork(
                labeled(
                    "request_status",
                    labeled(
                        request_id.to_vec(),
                        fork(
                            labeled("reply", leaf(candid::encode_one(&reply).unwrap())),
                            labeled("status", leaf(b"replied".to_vec())),
                        ),
                    ),
                ),
                labeled("time", leaf(leb128(NOW * NANOS_PER_MILLISECOND))),
            );
            let mut message = b"\x0Dic-state-root".to_vec();
            message.extend_from_slice(&tree.digest());
            let key = private_key(1);
            let certificate = Certificate {
                tree,
                signature: key.sign(&message).serialize().to_vec(),
                delegation: None,
            };
            let mut certificate_bytes = Vec::new();
            let mut serializer = serde_cbor::Serializer::new(&mut certificate_bytes);
            serializer.self_describe().unwrap();
            certificate.serialize(&mut serializer).unwrap();

            TestTransfer {
                transaction: PendingCryptoTransaction {
                    ledger,
                    token_symbol: "TEST".to_string(),
                    amount: 1000,
                    to,
                    fee: 10,
                    memo: Some(Memo::from(memo.clone())),
                    created: NOW * NANOS_PER_MILLISECOND,
                    call: CertifiedCall {
                        certificate: certificate_bytes,
                        ..call
                    },
                },
                sender,
                memo,
                root_key: TestTransfer::root_key(&key),
            }
        }

        fn verify(&self) -> Result<CompletedCryptoTransaction, OCError> {
            verify_certified_transfer(self.transaction.clone(), self.sender, &self.memo, &self.root_key, NOW)
        }

        fn root_key(key: &PrivateKey) -> Vec<u8> {
            let mut der = DER_PREFIX.to_vec();
            der.extend_from_slice(&key.public_key().serialize());
            der
        }
    }

    fn private_key(seed: u8) -> PrivateKey {
        let mut bytes = [0; 32];
        bytes[31] = seed;
        PrivateKey::deserialize(&bytes).unwrap()
    }

    fn leb128(mut value: u64) -> Vec<u8> {
        let mut bytes = Vec::new();
        loop {
            let byte = (value & 0x7f) as u8;
            value >>= 7;
            if value == 0 {
                bytes.push(byte);
                return bytes;
            }
            bytes.push(byte | 0x80);
        }
    }
}
