# Play Store release

Package `com.oclabs.openchat`, Computism Play Console account.

The build produces two artifacts from one release key (`~/keys/openchat-upload.jks`
locally, `ANDROID_UPLOAD_KEYSTORE_BASE64` and friends in CI):

- `openchat_<version>_full.apk` — hand-distributed, `OC_OTA_UPDATES=minor`
- `openchat_<version>_store.aab` — uploaded to Play, `OC_OTA_UPDATES=patch`

A device can hold only one of them. They carry different signatures once Play
re-signs the bundle, so moving between the two channels needs an uninstall.

## Blocking: assetlinks after the first upload

Play App Signing is mandatory for new apps. Google re-signs every download with
an app signing key it generates, so **the certificate on an installed Play build
is not the one in `frontend/app/assetlinks.json` today**. That file currently
lists the upload key.

Until it lists Google's, Play-installed builds have no App Links and, because the
statement also claims `get_login_creds`, **no passkeys**. Passkey sign-in is the
main route for these users, so this is a day-one break, not a cosmetic gap.

It cannot be fixed in advance: the app signing key does not exist until the first
bundle is uploaded. The order is therefore:

1. Upload the AAB to an internal testing track.
2. Play Console → Setup → App integrity → read the **app signing key** SHA-256
   (not the upload key, which is also shown there).
3. Add it to the `com.oclabs.openchat` entry in `frontend/app/assetlinks.json`,
   keeping the upload key fingerprint so hand-distributed APKs keep working.
4. Deploy the website so `https://oc.app/.well-known/assetlinks.json` serves it.
5. Verify on a device installed from Play: deep links open in the app, and
   passkey sign-in completes.
6. Only then promote to production.

`com.oc.app` keeps its own entry with the old fingerprints so existing sideloaded
installs are unaffected.

## Sideloaded installs on the old package

Builds before the rename are `com.oc.app` with `OC_OTA_UPDATES=major` compiled in.
Android treats the renamed app as unrelated software, so those installs:

- keep applying web updates over the air indefinitely, so they stay usable
- never receive native fixes again, since no APK will ever have that package name
- see none of the update prompts added for the new package
- will, if the user also installs the new app, hold a second valid FCM token for
  the same account, and both apps will ring

Nothing in the app can fix this, because the code deciding it is already on the
device. Migration has to be announced, and the new APK link published where those
users will see it. Until that happens, expect duplicate notifications from anyone
running both.

Removing the `com.oc.app` client from `google-services.json` would stop the
duplicates by silently killing push for everyone still on the old build. Do not.
