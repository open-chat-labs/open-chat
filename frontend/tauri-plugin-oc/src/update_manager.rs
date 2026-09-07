use futures_util::StreamExt;
use reqwest::Client;
use semver::Version;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Cursor;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager, Runtime};

const VERSION_ENDPOINT: &str = "https://oc.app/version";
const OTA_POLICY_ASSET: &str = "ota-policy.json";
// TODO: This needs to be the actual URL where the bundle can be downloaded
#[cfg(feature = "store")]
const BUNDLE_URL_TEMPLATE: &str = "https://oc.app/downloads/store-{}.zip";
#[cfg(not(feature = "store"))]
const BUNDLE_URL_TEMPLATE: &str = "https://oc.app/downloads/full-{}.zip";

#[derive(Serialize, Deserialize, Debug)]
struct ServerVersion {
    version: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct CachedVersion {
    version: String,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "lowercase")]
enum OtaUpdateStrategy {
    None,
    Patch,
    Minor,
    Major,
}

#[derive(Debug, Deserialize)]
struct OtaPolicy {
    strategy: OtaUpdateStrategy,
}

fn parse_ota_update_strategy(bytes: &[u8]) -> OtaUpdateStrategy {
    serde_json::from_slice::<OtaPolicy>(bytes)
        .map(|policy| policy.strategy)
        .unwrap_or(OtaUpdateStrategy::None)
}

fn can_update_to(current: &Version, candidate: &Version, strategy: OtaUpdateStrategy) -> bool {
    if candidate <= current {
        return false;
    }

    match strategy {
        OtaUpdateStrategy::None => false,
        OtaUpdateStrategy::Patch => {
            current.major == candidate.major && current.minor == candidate.minor
        }
        OtaUpdateStrategy::Minor => current.major == candidate.major,
        OtaUpdateStrategy::Major => true,
    }
}

fn parse_shell_version(bytes: &[u8]) -> Option<Version> {
    let info = serde_json::from_slice::<ServerVersion>(bytes).ok()?;
    Version::parse(info.version.trim_start_matches('v')).ok()
}

fn cache_version_allowed(
    bundled: Option<&Version>,
    cached: Option<&Version>,
    strategy: OtaUpdateStrategy,
) -> bool {
    match (bundled, cached) {
        (Some(bundled), Some(cached)) => can_update_to(bundled, cached, strategy),
        _ => false,
    }
}

fn current_version_for_updates(
    bundled: Option<Version>,
    cached: Option<Version>,
    strategy: OtaUpdateStrategy,
) -> Option<Version> {
    if strategy == OtaUpdateStrategy::None {
        return None;
    }
    let bundled = bundled?;
    Some(
        cached
            .filter(|cached| cache_version_allowed(Some(&bundled), Some(cached), strategy))
            .unwrap_or(bundled),
    )
}

#[derive(Serialize, Clone)]
struct ProgressPayload {
    progress: f64,
    downloaded: u64,
    total: u64,
}

pub struct UpdateManager<R: Runtime> {
    app_handle: AppHandle<R>,
}

impl<R: Runtime> UpdateManager<R> {
    pub fn new(app_handle: AppHandle<R>) -> Self {
        Self { app_handle }
    }

    pub fn get_cache_dir(&self) -> Option<PathBuf> {
        self.app_handle
            .path()
            .app_data_dir()
            .ok()
            .map(|p| p.join("updates"))
    }

    pub fn get_cached_version(&self) -> Option<Version> {
        let cache_dir = self.get_cache_dir()?;
        let version_file = cache_dir.join("version.json");

        if version_file.exists()
            && let Ok(file) = fs::File::open(&version_file)
            && let Ok(info) = serde_json::from_reader::<_, CachedVersion>(file)
        {
            return Version::parse(&info.version).ok();
        }
        None
    }

    /// The version of the web assets compiled into the installed binary, which
    /// is what identifies the shell itself. It changes only with a binary
    /// update. Distinct from `get_cached_version`, which is the most recent
    /// bundle downloaded over the air.
    pub fn get_shell_version(&self) -> Option<Version> {
        if let Some(asset) = self.app_handle.asset_resolver().get("version".to_string()) {
            return parse_shell_version(&asset.bytes);
        }
        // No fallback to package_info(): that reads tauri.conf.json's version,
        // a stale "0.1.0" placeholder unrelated to the shipped web assets. This
        // value exists to tell a crash report which shell is running, and a
        // confident wrong answer is worse than none.
        None
    }

    fn get_ota_update_strategy(&self) -> OtaUpdateStrategy {
        self.app_handle
            .asset_resolver()
            .get(OTA_POLICY_ASSET.to_string())
            .map(|asset| parse_ota_update_strategy(&asset.bytes))
            .unwrap_or(OtaUpdateStrategy::None)
    }

    /// Returns true only when the APK's bundled policy permits the preserved cache and the cached
    /// frontend is a compatible upgrade over the frontend bundled into this APK. This is evaluated
    /// by the native protocol handler before cached index.html can execute.
    pub fn cached_update_allowed(&self) -> bool {
        let strategy = self.get_ota_update_strategy();
        if strategy == OtaUpdateStrategy::None {
            return false;
        }
        // Cache selection must fail closed if the actual bundled frontend version cannot be read.
        // The package version is a stale native-shell placeholder and is not safe for this choice.
        cache_version_allowed(
            self.get_shell_version().as_ref(),
            self.get_cached_version().as_ref(),
            strategy,
        )
    }

    pub async fn get_server_version(&self) -> Result<Version, Box<dyn std::error::Error>> {
        let client = Client::new();
        let resp = client.get(VERSION_ENDPOINT).send().await?;
        let server_info: ServerVersion = resp.json().await?;
        let server_version = Version::parse(&server_info.version)?;
        Ok(server_version)
    }

    pub async fn check_for_updates(&self) -> Result<bool, Box<dyn std::error::Error>> {
        let strategy = self.get_ota_update_strategy();
        if strategy == OtaUpdateStrategy::None {
            return Ok(false);
        }

        // Unknown bundled assets are not version 0.0.0 (or the native package
        // placeholder). Without a truthful shell version, do not contact OTA.
        let Some(current_version) = current_version_for_updates(
            self.get_shell_version(),
            self.get_cached_version(),
            strategy,
        ) else {
            return Ok(false);
        };

        let server_version = self.get_server_version().await?;

        if can_update_to(&current_version, &server_version, strategy) {
            println!(
                "New version available: {} (current={})",
                server_version, current_version
            );
            self.download_and_install(&server_version).await?;
            return Ok(true);
        }

        Ok(false)
    }

    async fn download_and_install(
        &self,
        version: &Version,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let url = BUNDLE_URL_TEMPLATE.replace("{}", &version.to_string());
        println!("Downloading update from {}", url);

        let client = Client::new();
        let resp = client
            .get(&url)
            .header("Accept-Encoding", "identity")
            .send()
            .await?;

        if !resp.status().is_success() {
            // TODO what do we do here? Retry?
            return Err(format!("Failed to download bundle: {}", resp.status()).into());
        }

        let content_length = resp.content_length();
        let total_size = content_length.unwrap_or(15 * 1024 * 1024);
        let is_estimated = content_length.is_none();

        println!(
            "Starting download. Total size: {} (estimated: {})",
            total_size, is_estimated
        );

        let mut downloaded: u64 = 0;
        let mut stream = resp.bytes_stream();
        let mut bytes = Vec::with_capacity(total_size as usize);

        while let Some(item) = stream.next().await {
            let chunk = item?;
            bytes.extend_from_slice(&chunk);
            downloaded += chunk.len() as u64;

            let mut progress = (downloaded as f64 / total_size as f64) * 100.0;
            if is_estimated && progress > 99.0 {
                progress = 99.0;
            }

            self.app_handle.emit(
                "update-progress",
                ProgressPayload {
                    progress,
                    downloaded,
                    total: if is_estimated { 0 } else { total_size },
                },
            )?;
        }
        let reader = Cursor::new(bytes);
        let mut archive = zip::ZipArchive::new(reader)?;

        let cache_dir = self.get_cache_dir().ok_or("Could not get cache dir")?;
        if !cache_dir.exists() {
            fs::create_dir_all(&cache_dir)?;
        }

        archive.extract(&cache_dir)?;

        // Write version file
        let version_info = CachedVersion {
            version: version.to_string(),
        };
        let version_file = cache_dir.join("version.json");
        let file = fs::File::create(&version_file)?;
        serde_json::to_writer(file, &version_info)?;

        println!("Update installed to {:?}", cache_dir);

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::{
        OtaUpdateStrategy, cache_version_allowed, can_update_to, current_version_for_updates,
        parse_ota_update_strategy, parse_shell_version,
    };
    use semver::Version;

    #[test]
    fn missing_or_invalid_policy_fails_closed() {
        assert_eq!(parse_ota_update_strategy(br#"{}"#), OtaUpdateStrategy::None);
        assert_eq!(
            parse_ota_update_strategy(br#"{"strategy":"unexpected"}"#),
            OtaUpdateStrategy::None
        );
        assert_eq!(
            parse_ota_update_strategy(br#"not json"#),
            OtaUpdateStrategy::None
        );
    }

    #[test]
    fn disabled_policy_rejects_every_cached_update() {
        let bundled = Version::parse("2.0.0-mobile-rc33").unwrap();
        let live = Version::parse("2.0.2000").unwrap();

        assert!(!can_update_to(&bundled, &live, OtaUpdateStrategy::None));
    }

    #[test]
    fn enabled_policies_enforce_their_version_boundary() {
        let bundled = Version::parse("2.3.4").unwrap();

        assert!(can_update_to(
            &bundled,
            &Version::parse("2.3.5").unwrap(),
            OtaUpdateStrategy::Patch
        ));
        assert!(!can_update_to(
            &bundled,
            &Version::parse("2.4.0").unwrap(),
            OtaUpdateStrategy::Patch
        ));
        assert!(can_update_to(
            &bundled,
            &Version::parse("2.4.0").unwrap(),
            OtaUpdateStrategy::Minor
        ));
        assert!(!can_update_to(
            &bundled,
            &Version::parse("3.0.0").unwrap(),
            OtaUpdateStrategy::Minor
        ));
        assert!(can_update_to(
            &bundled,
            &Version::parse("3.0.0").unwrap(),
            OtaUpdateStrategy::Major
        ));
    }

    #[test]
    fn cache_must_be_strictly_newer_than_the_bundled_frontend() {
        let bundled = Version::parse("2.3.4").unwrap();

        assert!(!can_update_to(&bundled, &bundled, OtaUpdateStrategy::Major));
        assert!(!can_update_to(
            &bundled,
            &Version::parse("2.3.3").unwrap(),
            OtaUpdateStrategy::Major
        ));
    }

    #[test]
    fn shell_version_reports_only_valid_bundled_asset_content() {
        for input in [
            br#"{"version":"v2.3.4"}"#.as_slice(),
            br#"{"version":"2.3.4"}"#.as_slice(),
        ] {
            assert_eq!(parse_shell_version(input), Some(Version::new(2, 3, 4)));
        }
        for input in [
            b"".as_slice(),
            b"not json".as_slice(),
            br#"{}"#.as_slice(),
            br#"{"version":null}"#.as_slice(),
            br#"{"version":"not-a-version"}"#.as_slice(),
        ] {
            assert_eq!(parse_shell_version(input), None);
            assert_eq!(
                current_version_for_updates(
                    parse_shell_version(input),
                    Some(Version::new(9, 0, 0)),
                    OtaUpdateStrategy::Major,
                ),
                None,
            );
        }
    }

    #[test]
    fn cache_serving_and_download_baseline_share_policy_boundaries() {
        let bundled = Version::new(2, 3, 4);
        let candidates = [
            None,
            Some(Version::new(2, 3, 3)),
            Some(bundled.clone()),
            Some(Version::new(2, 3, 5)),
            Some(Version::new(2, 4, 0)),
            Some(Version::new(3, 0, 0)),
        ];
        for (strategy, eligible) in [
            (
                OtaUpdateStrategy::None,
                [false, false, false, false, false, false],
            ),
            (
                OtaUpdateStrategy::Patch,
                [false, false, false, true, false, false],
            ),
            (
                OtaUpdateStrategy::Minor,
                [false, false, false, true, true, false],
            ),
            (
                OtaUpdateStrategy::Major,
                [false, false, false, true, true, true],
            ),
        ] {
            for (cached, allowed) in candidates.iter().zip(eligible) {
                assert_eq!(
                    cache_version_allowed(Some(&bundled), cached.as_ref(), strategy),
                    allowed,
                    "strategy={strategy:?}, cached={cached:?}",
                );
                let current =
                    current_version_for_updates(Some(bundled.clone()), cached.clone(), strategy);
                let expected = if strategy == OtaUpdateStrategy::None {
                    None
                } else if allowed {
                    cached.clone()
                } else {
                    Some(bundled.clone())
                };
                assert_eq!(current, expected);
                assert!(!cache_version_allowed(None, cached.as_ref(), strategy));
                assert_eq!(
                    current_version_for_updates(None, cached.clone(), strategy),
                    None
                );
            }
        }
    }

    #[test]
    fn ignored_cache_cannot_mask_an_allowed_server_update() {
        let bundled = Version::new(2, 3, 4);
        let current = current_version_for_updates(
            Some(bundled.clone()),
            Some(Version::new(3, 0, 0)),
            OtaUpdateStrategy::Patch,
        )
        .unwrap();
        assert_eq!(current, bundled);
        assert!(can_update_to(
            &current,
            &Version::new(2, 3, 5),
            OtaUpdateStrategy::Patch
        ));
        assert!(!can_update_to(
            &current,
            &Version::new(2, 4, 0),
            OtaUpdateStrategy::Patch
        ));

        let current = current_version_for_updates(
            Some(bundled),
            Some(Version::new(2, 3, 5)),
            OtaUpdateStrategy::Patch,
        )
        .unwrap();
        assert!(!can_update_to(
            &current,
            &Version::new(2, 3, 5),
            OtaUpdateStrategy::Patch
        ));
        assert!(can_update_to(
            &current,
            &Version::new(2, 3, 6),
            OtaUpdateStrategy::Patch
        ));
    }
}
