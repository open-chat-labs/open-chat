use ic_cbor::{parse_cbor, CborValue, CertificateToCbor};
use ic_certification::Certificate;

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
