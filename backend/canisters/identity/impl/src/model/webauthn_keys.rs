use candid::Deserialize;
use identity_canister::WebAuthnKey;
use serde::Serialize;
use serde_bytes::ByteBuf;
use std::collections::HashMap;
use std::collections::hash_map::Entry::Vacant;
use types::TimestampMillis;

#[derive(Serialize, Deserialize, Default)]
pub struct WebAuthnKeys {
    keys: HashMap<ByteBuf, WebAuthnKeyInternal>,
}

impl WebAuthnKeys {
    pub fn add(&mut self, key: WebAuthnKey, now: TimestampMillis) {
        if let Vacant(e) = self.keys.entry(key.credential_id.into()) {
            e.insert(WebAuthnKeyInternal {
                public_key: key.public_key,
                origin: key.origin,
                cross_platform: key.cross_platform,
                aaguid: key.aaguid,
                created: now,
            });
        } else {
            panic!("WebAuthn credential already exists");
        }
    }

    pub fn get(&self, credential_id: Vec<u8>) -> Option<&WebAuthnKeyInternal> {
        self.keys.get(&ByteBuf::from(credential_id))
    }

    /// Finds any stored keys whose COSE key is followed by additional data (see
    /// `strip_trailing_bytes_from_der_cose_key`) and calls `remap` with the details of each. The stored
    /// key is only replaced with the repaired one if `remap` returns true, so that a key and the auth
    /// principal derived from it can't be left disagreeing with each other. Returns the details of every
    /// malformed key found, along with whether it was repaired.
    pub fn repair_malformed_keys(&mut self, mut remap: impl FnMut(&RepairedWebAuthnKey) -> bool) -> Vec<RepairedWebAuthnKey> {
        let mut results = Vec::new();
        for (credential_id, key) in self.keys.iter_mut() {
            if let Some(new_public_key) = strip_trailing_bytes_from_der_cose_key(&key.public_key) {
                let mut repaired = RepairedWebAuthnKey {
                    credential_id: credential_id.to_vec(),
                    old_public_key: key.public_key.clone(),
                    new_public_key,
                    repaired: false,
                };
                if remap(&repaired) {
                    key.public_key = repaired.new_public_key.clone();
                    repaired.repaired = true;
                }
                results.push(repaired);
            }
        }
        results
    }
}

pub struct RepairedWebAuthnKey {
    pub credential_id: Vec<u8>,
    pub old_public_key: Vec<u8>,
    pub new_public_key: Vec<u8>,
    pub repaired: bool,
}

// DER encoding of `SEQUENCE { OBJECT IDENTIFIER 1.3.6.1.4.1.56387.1.1 }`, the OID the IC uses to wrap COSE keys
const DER_COSE_OID: [u8; 14] = [
    0x30, 0x0c, 0x06, 0x0a, 0x2b, 0x06, 0x01, 0x04, 0x01, 0x83, 0xb8, 0x43, 0x01, 0x01,
];

/// WebAuthn public keys are stored as DER: `SEQUENCE { DER_COSE_OID, BIT STRING { 0x00, <COSE key> } }`.
///
/// The frontend used to extract the COSE key by taking everything after the credential ID in the
/// authenticator data, so when an authenticator set the ED flag (eg. YubiKeys adding a `credProtect`
/// extension) the CBOR extensions map was included after the COSE key. The IC rejects such keys with
/// "Failed to parse COSE public key", locking the user out.
///
/// If the COSE key within `der` is followed by trailing bytes, this returns the DER encoding of just the
/// COSE key, else it returns `None`.
pub fn strip_trailing_bytes_from_der_cose_key(der: &[u8]) -> Option<Vec<u8>> {
    let cose_key = unwrap_der_cose_key(der).ok()?;
    let cose_key_length = cbor_item_length(cose_key)?;
    if cose_key_length == cose_key.len() {
        None
    } else {
        Some(der_wrap_cose_key(&cose_key[..cose_key_length]))
    }
}

/// Checks that `der` is a DER wrapped COSE key which the IC will accept when verifying WebAuthn
/// signatures. This mirrors the checks in the IC's COSE parser so that a malformed key is rejected at
/// registration rather than locking the user out at their next sign in.
pub fn validate_der_cose_key(der: &[u8]) -> Result<(), String> {
    use serde_cbor::Value;

    const KTY: Value = Value::Integer(1);
    const ALG: Value = Value::Integer(3);
    const KEY_OPS: Value = Value::Integer(4);
    const CRV: Value = Value::Integer(-1);
    const X: Value = Value::Integer(-2);
    const Y: Value = Value::Integer(-3);
    const RSA_N: Value = Value::Integer(-1);
    const RSA_E: Value = Value::Integer(-2);

    const KTY_OKP: Value = Value::Integer(1);
    const KTY_EC2: Value = Value::Integer(2);
    const KTY_RSA: Value = Value::Integer(3);
    const ALG_ES256: Value = Value::Integer(-7);
    const ALG_EDDSA: Value = Value::Integer(-8);
    const ALG_RS256: Value = Value::Integer(-257);
    const CRV_P256: Value = Value::Integer(1);
    const CRV_ED25519: Value = Value::Integer(6);

    let cose_key = unwrap_der_cose_key(der)?;

    let mut deserializer = serde_cbor::Deserializer::from_slice(cose_key);
    let value: Value =
        serde::Deserialize::deserialize(&mut deserializer).map_err(|e| format!("COSE key is not valid CBOR: {e}"))?;
    if deserializer.byte_offset() != cose_key.len() {
        return Err(format!(
            "COSE key is followed by {} trailing bytes",
            cose_key.len() - deserializer.byte_offset()
        ));
    }

    let Value::Map(fields) = value else {
        return Err("COSE key is not a CBOR map".to_string());
    };
    let kty = fields.get(&KTY).ok_or("COSE key is missing kty")?;
    let alg = fields.get(&ALG).ok_or("COSE key is missing alg")?;
    // The COSE spec defines key_ops as an array, but the IC's parser (`ic_crypto_internal_basic_sig_cose`)
    // only accepts it as the bare text "verify" and rejects anything else, including ["verify"]. Since a
    // key the IC rejects would lock the user out, this deliberately mirrors the IC rather than the spec.
    if fields
        .get(&KEY_OPS)
        .is_some_and(|ops| *ops != Value::Text("verify".to_string()))
    {
        return Err("COSE key has unsupported key_ops".to_string());
    }

    let bytes_field = |key: &Value, name: &str| -> Result<&[u8], String> {
        match fields.get(key) {
            Some(Value::Bytes(bytes)) => Ok(bytes),
            Some(_) => Err(format!("COSE key field {name} is not a byte string")),
            None => Err(format!("COSE key is missing {name}")),
        }
    };

    if *kty == KTY_EC2 && *alg == ALG_ES256 {
        if fields.get(&CRV) != Some(&CRV_P256) {
            return Err("ES256 COSE key must use the P-256 curve".to_string());
        }
        if bytes_field(&X, "x")?.len() != 32 || bytes_field(&Y, "y")?.len() != 32 {
            return Err("ES256 COSE key coordinates must be 32 bytes".to_string());
        }
    } else if *kty == KTY_RSA && *alg == ALG_RS256 {
        bytes_field(&RSA_N, "n")?;
        bytes_field(&RSA_E, "e")?;
    } else if *kty == KTY_OKP && *alg == ALG_EDDSA {
        if fields.get(&CRV) != Some(&CRV_ED25519) {
            return Err("EdDSA COSE key must use the Ed25519 curve".to_string());
        }
        if bytes_field(&X, "x")?.len() != 32 {
            return Err("Ed25519 COSE key must be 32 bytes".to_string());
        }
    } else {
        return Err(format!("COSE key algorithm not supported: kty {kty:?}, alg {alg:?}"));
    }
    Ok(())
}

// Returns the COSE key contained within a DER encoded WebAuthn public key
fn unwrap_der_cose_key(der: &[u8]) -> Result<&[u8], String> {
    let (sequence_length, sequence) = read_der_header(der, 0x30).ok_or("Not a DER sequence")?;
    if sequence.len() != sequence_length {
        return Err("DER sequence length does not match".to_string());
    }
    let bit_string_der = sequence
        .strip_prefix(&DER_COSE_OID)
        .ok_or("DER sequence does not start with the COSE OID")?;
    let (bit_string_length, bit_string) = read_der_header(bit_string_der, 0x03).ok_or("Not a DER bit string")?;
    if bit_string.len() != bit_string_length {
        return Err("DER bit string length does not match".to_string());
    }
    // The first byte of a BIT STRING is the number of unused bits, which is always 0 here
    bit_string
        .strip_prefix(&[0u8])
        .ok_or_else(|| "DER bit string has unused bits".to_string())
}

// Returns the length of the first CBOR data item in `bytes`, as parsed by the same CBOR library the IC uses
fn cbor_item_length(bytes: &[u8]) -> Option<usize> {
    let mut deserializer = serde_cbor::Deserializer::from_slice(bytes);
    let _: serde_cbor::Value = serde::Deserialize::deserialize(&mut deserializer).ok()?;
    Some(deserializer.byte_offset())
}

// Returns the length and contents of a DER element with the given tag, or `None` if the tag doesn't match
fn read_der_header(bytes: &[u8], tag: u8) -> Option<(usize, &[u8])> {
    if bytes.first() != Some(&tag) {
        return None;
    }
    let first_length_byte = *bytes.get(1)?;
    if first_length_byte < 0x80 {
        Some((first_length_byte as usize, &bytes[2..]))
    } else {
        let length_bytes = (first_length_byte & 0x7f) as usize;
        if length_bytes == 0 || length_bytes > 2 {
            return None;
        }
        let length = bytes
            .get(2..2 + length_bytes)?
            .iter()
            .fold(0usize, |acc, b| (acc << 8) | *b as usize);
        Some((length, &bytes[2 + length_bytes..]))
    }
}

fn der_length(length: usize) -> Vec<u8> {
    if length < 0x80 {
        vec![length as u8]
    } else if length < 0x100 {
        vec![0x81, length as u8]
    } else {
        vec![0x82, (length >> 8) as u8, length as u8]
    }
}

fn der_wrap_cose_key(cose_key: &[u8]) -> Vec<u8> {
    let mut bit_string = vec![0x03];
    bit_string.extend(der_length(cose_key.len() + 1));
    bit_string.push(0);
    bit_string.extend_from_slice(cose_key);

    let mut der = vec![0x30];
    der.extend(der_length(DER_COSE_OID.len() + bit_string.len()));
    der.extend_from_slice(&DER_COSE_OID);
    der.extend(bit_string);
    der
}

#[derive(Serialize, Deserialize)]
pub struct WebAuthnKeyInternal {
    #[serde(rename = "p")]
    pub public_key: Vec<u8>,
    #[serde(rename = "o")]
    pub origin: String,
    #[serde(rename = "x")]
    pub cross_platform: bool,
    #[serde(rename = "g")]
    pub aaguid: [u8; 16],
    #[serde(rename = "c")]
    pub created: TimestampMillis,
}

impl WebAuthnKeyInternal {
    pub fn hydrate(&self, credential_id: Vec<u8>) -> WebAuthnKey {
        WebAuthnKey {
            public_key: self.public_key.clone(),
            credential_id,
            origin: self.origin.clone(),
            cross_platform: self.cross_platform,
            aaguid: self.aaguid,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hex(s: &str) -> Vec<u8> {
        (0..s.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap())
            .collect()
    }

    const DER_PREFIX: &str = "300c060a2b0601040183b8430101";
    // A 77 byte ES256 COSE key
    const ES256_COSE_KEY: &str = "a5010203262001215820132dde7268f60188d05e5443f006e63af7a90b63ebfa1b7918ff84ad5b2941122258201dac287792b39696610992e3d7f3eae616ff2241dc3177e428d5fd3b1ff691f4";
    // CBOR {"credProtect": 3} - the authenticator data extensions map
    const CRED_PROTECT_EXTENSION: &str = "a16b6372656450726f7465637403";

    fn malformed_key() -> Vec<u8> {
        hex(&format!("306c{DER_PREFIX}035c00{ES256_COSE_KEY}{CRED_PROTECT_EXTENSION}"))
    }

    fn valid_key() -> Vec<u8> {
        hex(&format!("305e{DER_PREFIX}034e00{ES256_COSE_KEY}"))
    }

    #[test]
    fn strips_trailing_extension_bytes() {
        let malformed = malformed_key();
        assert_eq!(malformed.len(), 110);

        let repaired = strip_trailing_bytes_from_der_cose_key(&malformed).unwrap();
        assert_eq!(repaired.len(), 96);
        assert_eq!(repaired, valid_key());
    }

    #[test]
    fn valid_key_is_left_unchanged() {
        assert!(strip_trailing_bytes_from_der_cose_key(&valid_key()).is_none());
        assert!(strip_trailing_bytes_from_der_cose_key(&der_wrap_cose_key(&hex(ES256_COSE_KEY))).is_none());
    }

    #[test]
    fn der_wrap_round_trips() {
        let cose_with_extension = hex(&format!("{ES256_COSE_KEY}{CRED_PROTECT_EXTENSION}"));
        assert_eq!(der_wrap_cose_key(&cose_with_extension), malformed_key());
    }

    #[test]
    fn handles_long_form_der_lengths() {
        // An RSA COSE key with a 256 byte modulus: {1: 3, 3: -257, -1: n, -2: e}
        let rsa_cose_key = hex(&format!("a40103033901002059{}{}2143010001", "0100", "33".repeat(256)));
        let mut malformed_cose = rsa_cose_key.clone();
        malformed_cose.extend(hex(CRED_PROTECT_EXTENSION));

        let malformed = der_wrap_cose_key(&malformed_cose);
        assert_eq!(&malformed[..4], &[0x30, 0x82, 0x01, 0x31]);
        let repaired = strip_trailing_bytes_from_der_cose_key(&malformed).unwrap();
        assert_eq!(repaired, der_wrap_cose_key(&rsa_cose_key));
        assert!(strip_trailing_bytes_from_der_cose_key(&repaired).is_none());
    }

    #[test]
    fn garbage_is_left_unchanged() {
        assert!(strip_trailing_bytes_from_der_cose_key(&[]).is_none());
        assert!(strip_trailing_bytes_from_der_cose_key(&[0x30]).is_none());
        assert!(strip_trailing_bytes_from_der_cose_key(&hex("3005300306010100")).is_none());
        // Truncated key
        assert!(strip_trailing_bytes_from_der_cose_key(&valid_key()[..50]).is_none());
    }

    #[test]
    fn validate_accepts_valid_keys() {
        assert_eq!(validate_der_cose_key(&valid_key()), Ok(()));

        // {1: 3, 3: -257, -1: n, -2: e}
        let rsa = hex(&format!("a40103033901002059{}{}2143010001", "0100", "33".repeat(256)));
        assert_eq!(validate_der_cose_key(&der_wrap_cose_key(&rsa)), Ok(()));

        // {1: 1, 3: -8, -1: 6, -2: x}
        let ed25519 = hex(&format!("a401010327200621{}{}", "5820", "44".repeat(32)));
        assert_eq!(validate_der_cose_key(&der_wrap_cose_key(&ed25519)), Ok(()));

        // key_ops as the bare text "verify" is accepted, matching the IC's parser
        let x = format!("5820{}", "11".repeat(32));
        let y = format!("5820{}", "22".repeat(32));
        let with_key_ops = hex(&format!("a60102032604 6676 6572 6966 79 2001 21{x} 22{y}").replace(' ', ""));
        assert_eq!(validate_der_cose_key(&der_wrap_cose_key(&with_key_ops)), Ok(()));
    }

    #[test]
    fn validate_rejects_trailing_bytes() {
        let error = validate_der_cose_key(&malformed_key()).unwrap_err();
        assert!(error.contains("14 trailing bytes"), "{error}");
    }

    #[test]
    fn validate_rejects_malformed_keys() {
        let reject = |cose_hex: &str, expected: &str| {
            let error = validate_der_cose_key(&der_wrap_cose_key(&hex(cose_hex))).unwrap_err();
            assert!(error.contains(expected), "{error} does not contain {expected}");
        };
        let x = format!("5820{}", "11".repeat(32));
        let y = format!("5820{}", "22".repeat(32));

        // Not a map
        reject("01", "not a CBOR map");
        // Missing alg
        reject(&format!("a30102200121{x}"), "missing alg");
        // Unsupported alg (ES384)
        reject(&format!("a5010203222001 21{x} 22{y}").replace(' ', ""), "not supported");
        // Wrong curve (P-384)
        reject(&format!("a5010203262002 21{x} 22{y}").replace(' ', ""), "P-256");
        // Coordinate too short
        reject(
            &format!("a5010203262001 21{x} 22581f{}", "22".repeat(31)).replace(' ', ""),
            "32 bytes",
        );
        // Coordinate not a byte string
        reject(&format!("a5010203262001 21{x} 2201").replace(' ', ""), "not a byte string");
        // Unsupported key_ops (["sign"])
        reject(
            &format!("a6010203260481 6473 6967 6e2001 21{x} 22{y}").replace(' ', ""),
            "key_ops",
        );
        // key_ops as an array is rejected by the IC even when it is ["verify"]
        reject(
            &format!("a6010203260481 6676 6572 6966 792001 21{x} 22{y}").replace(' ', ""),
            "key_ops",
        );
        // Missing RSA exponent
        reject(
            &format!("a3010303390100 2059{}{}", "0100", "33".repeat(256)).replace(' ', ""),
            "missing e",
        );
    }

    #[test]
    fn validate_rejects_invalid_der() {
        assert!(validate_der_cose_key(&[]).is_err());
        assert!(validate_der_cose_key(&valid_key()[..50]).is_err());
        // Wrong OID
        let mut wrong_oid = valid_key();
        wrong_oid[10] ^= 1;
        assert!(validate_der_cose_key(&wrong_oid).unwrap_err().contains("OID"));
        // Invalid CBOR
        assert!(
            validate_der_cose_key(&der_wrap_cose_key(&[0xa5, 0x01]))
                .unwrap_err()
                .contains("not valid CBOR")
        );
    }

    #[test]
    fn repairs_only_malformed_stored_keys() {
        let mut keys = WebAuthnKeys::default();
        let add = |keys: &mut WebAuthnKeys, credential_id: u8, public_key: Vec<u8>| {
            keys.add(
                WebAuthnKey {
                    public_key,
                    credential_id: vec![credential_id],
                    origin: "oc.app".to_string(),
                    cross_platform: true,
                    aaguid: [0; 16],
                },
                1,
            );
        };
        add(&mut keys, 1, valid_key());
        add(&mut keys, 2, malformed_key());

        // The malformed key is left untouched if the remap fails
        let not_remapped = keys.repair_malformed_keys(|_| false);
        assert_eq!(not_remapped.len(), 1);
        assert_eq!(not_remapped[0].credential_id, vec![2]);
        assert!(!not_remapped[0].repaired);
        assert_eq!(keys.get(vec![1]).unwrap().public_key, valid_key());
        assert_eq!(keys.get(vec![2]).unwrap().public_key, malformed_key());

        let repaired = keys.repair_malformed_keys(|_| true);
        assert_eq!(repaired.len(), 1);
        assert_eq!(repaired[0].credential_id, vec![2]);
        assert_eq!(repaired[0].old_public_key, malformed_key());
        assert_eq!(repaired[0].new_public_key, valid_key());
        assert!(repaired[0].repaired);

        assert_eq!(keys.get(vec![1]).unwrap().public_key, valid_key());
        assert_eq!(keys.get(vec![2]).unwrap().public_key, valid_key());
        assert!(keys.repair_malformed_keys(|_| true).is_empty());
    }
}
