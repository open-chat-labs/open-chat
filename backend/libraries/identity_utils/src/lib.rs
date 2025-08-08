use constants::NANOS_PER_MILLISECOND;
use ic_cbor::{CborValue, CertificateToCbor, parse_cbor};
use ic_certificate_verification::{CertificateVerificationError, VerifyCertificate};
use ic_certification::Certificate;
use oc_error_codes::OCErrorCode;
use types::{CanisterId, Milliseconds, OCResult, TimestampMillis};

pub fn verify_signature(
    signature: &[u8],
    originating_canister_id: CanisterId,
    max_offset: Milliseconds,
    ic_root_key: &[u8],
    now: TimestampMillis,
) -> OCResult {
    let certificate = extract_certificate(signature).map_err(|e| OCErrorCode::MalformedSignature.with_message(e))?;
    let now_nanos = (now * NANOS_PER_MILLISECOND) as u128;
    let max_offset_nanos = (max_offset * NANOS_PER_MILLISECOND) as u128;
    certificate
        .verify(originating_canister_id.as_slice(), ic_root_key, &now_nanos, &max_offset_nanos)
        .map_err(|error| {
            (match error {
                CertificateVerificationError::TimeTooFarInThePast { .. } => OCErrorCode::DelegationTooOld,
                _ => OCErrorCode::InvalidSignature,
            })
            .into()
        })
}

pub fn extract_certificate(signature: &[u8]) -> Result<Certificate, String> {
    let Ok(cbor) = parse_cbor(signature) else {
        return Err("Unable to parse signature as CBOR".to_string());
    };
    let CborValue::Map(map) = cbor else {
        return Err("Expected CBOR map".to_string());
    };
    let Some(CborValue::ByteString(certificate_bytes)) = map.get("certificate") else {
        return Err("Couldn't find certificate".to_string());
    };
    Certificate::from_cbor(certificate_bytes).map_err(|_| "Unable to parse certificate".to_string())
}
