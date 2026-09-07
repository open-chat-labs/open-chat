# Component identity contract tests

These offline tests compile the current production `IntentsManager.kt` and app
`MyApplication.kt`; they do not reproduce their implementation in test code.
They are deliberately outside Gradle's source sets and add no production or test
dependency to the application.

The JUnit matrix covers matching and mismatched installed package/class namespace,
both sides of the existing API 23 PendingIntent flag branch, all four intent paths,
clear errors before registration, cold Application startup before Firebase/database
callbacks, foreground lifecycle updates, and background-thread use without creating
an Activity. Android factories are explicit recording doubles. Firebase, lifecycle,
database, app component classes and notification serialization are explicit fixtures;
the opaque notification payload must pass through unchanged.

A second compilation omits every `android.*` double and uses the supplied real
Android SDK `android.jar`. It checks the production source's Android API/types and
seven SDK constants used by the recording doubles. The non-Android collaborators
remain fixtures, so this is not a complete app compilation.

Run `run.ps1` with existing local tools only:

```powershell
./run.ps1 -JavaHome $jdkPath `
    -KotlinCompilerClasspath $compilerJars `
    -KotlinRuntimeClasspath $runtimeJars `
    -JUnitClasspath $junitAndHamcrestJars `
    -AndroidJar $sdkAndroidJar `
    -OutputDirectory $freshTestOutput
```

Classpaths use the platform path separator. Supply the complete cached Kotlin
compiler dependency classpath, Kotlin runtime, and JUnit 4.13.2/Hamcrest. The runner
does not fetch dependencies, modify defaults, or reuse an existing output directory.
It prints the hashes of the actual production sources it compiles.

The independent `android-component-contracts` job in
`.github/workflows/on_device_model_security.yaml` runs this same runner on pull
requests using Java 21 and SDK 36. It provisions only the nine test-tool JARs in
`scripts/android_component_identity_tools.json`, with exact byte/SHA-256 checks
before producing classpaths. The manifest records the distinction between locally
computed SHA-256 pins and corroborating official Maven Central `.sha1` metadata:
https://central.sonatype.org/publish/requirements/#provide-file-checksums.
There are no mutable dependency versions, cache scans, redirects, retries,
credentials, Tauri initialization, native signing, or application dependencies in
this resolver. Each artifact has a 60-second deadline and bounded size. Fresh
download and compilation directories are mandatory; failed partial downloads are
left as `.part` diagnostics and are never accepted as JARs. Offline fixture tests
exercise these failure boundaries separately from the actual Kotlin/SDK job.

This is host contract and SDK compilation evidence, **not Robolectric or Android
runtime proof**. Before a phone handoff, separately validate a real merged manifest
and same-certificate in-place APK update, then exercise cold/background notification
tap, summary/individual dismissal and shortcut launch with installed application ID
different from class namespace. Do not uninstall or clear account data to perform
that validation.
