import java.io.File
import java.util.Properties
import org.jetbrains.kotlin.gradle.tasks.KotlinJvmCompile
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("rust")
    id("com.google.gms.google-services")
}

val tauriProperties = Properties().apply {
    val propFile = file("tauri.properties")
    if (propFile.exists()) {
        propFile.inputStream().use { load(it) }
    }
}

// Release signing.
//
// Reads gen/android/keystore.properties (gitignored - it holds the password),
// overridable by OC_ANDROID_* env vars so CI can inject the key from secrets.
//
// This key signs both artifacts, but only the APK still carries it once
// installed: Play App Signing re-signs the AAB with a key Google holds, so a
// Play install presents a DIFFERENT certificate. assetlinks.json therefore has
// to list both fingerprints, this one for hand-installed APKs and Google's for
// Play installs, or the affected channel loses App Links and, because the
// statement claims get_login_creds, passkeys. See PLAY_STORE_RELEASE.md.
//
// No keystore at all falls back to debug signing, so a fresh clone can still
// build a release locally. A keystore that is CONFIGURED but absent is a hard
// failure: falling through to debug signing there produces an artifact Play
// rejects outright, and one that no device will accept as an update over a
// properly signed build (INSTALL_FAILED_UPDATE_INCOMPATIBLE, fixable only by
// uninstalling, which wipes the account's local data). CI supplies the keystore
// and fails before the build if the secret is missing.
val keystoreDir = rootProject.projectDir
val keystoreProperties = Properties().apply {
    val propFile = File(keystoreDir, "keystore.properties")
    if (propFile.exists()) propFile.inputStream().use { load(it) }
}
fun signingProperty(name: String, env: String): String? =
    System.getenv(env)?.takeIf { it.isNotBlank() }
        ?: keystoreProperties.getProperty(name)?.takeIf { it.isNotBlank() }

// A relative storeFile resolves against the directory holding the properties file.
val releaseKeystore = signingProperty("storeFile", "OC_ANDROID_KEYSTORE_PATH")
    ?.let { path -> File(path).takeIf { it.isAbsolute } ?: File(keystoreDir, path) }
    ?.also { if (!it.exists()) throw GradleException("Android keystore not found: $it") }

// Release version, passed in by CI as the tag's version (e.g. 2.0.2051).
//
// Play requires versionCode to increase on every upload and never allows a
// value to be reused, so it is DERIVED from the name rather than supplied
// separately - the two can then never disagree.
//
// major*1000000 + minor*10000 + patch stays monotonic across the version bumps
// the OTA convention relies on: 2.0.2051 -> 2002051, then 2.1.0 -> 2010000,
// then 3.0.0 -> 3000000. Taking the patch component alone would send 2051 -> 0
// on a minor bump and Play would reject the upload. Tauri's own formula
// (major*1000000 + minor*1000 + patch) caps patch at 999 and cannot express an
// OpenChat version at all, which is why every APK so far has been stuck at 1000.
//
// Unset for local and manual builds, which fall back to tauri.properties.
val releaseVersionName: String? =
    System.getenv("OC_ANDROID_VERSION_NAME")?.takeIf { it.isNotBlank() }

val releaseVersionCode: Int? = releaseVersionName?.let { name ->
    val parts = name.split(".")
    if (parts.size != 3) {
        throw GradleException("OC_ANDROID_VERSION_NAME is not major.minor.patch: $name")
    }
    val (major, minor, patch) = parts.map {
        it.toIntOrNull()
            ?: throw GradleException("OC_ANDROID_VERSION_NAME is not major.minor.patch: $name")
    }
    // toIntOrNull accepts a leading minus, and the formula silently overflows
    // Int somewhere above major 2147. Both produce a negative versionCode that
    // Play rejects at upload, long after the build. The upper bound also keeps
    // the result under Play's own ceiling of 2100000000.
    if (major !in 0..2000 || minor !in 0..99 || patch !in 0..9999) {
        throw GradleException(
            "Version $name is out of range for the versionCode formula " +
                "(major 0..2000, minor 0..99, patch 0..9999)")
    }
    major * 1_000_000 + minor * 10_000 + patch
}

android {
    compileSdk = 36
    namespace = "com.oclabs.openchat"
    defaultConfig {
        manifestPlaceholders["usesCleartextTraffic"] = "false"
        applicationId = "com.oclabs.openchat"
        minSdk = 24
        targetSdk = 36
        versionCode = releaseVersionCode
            ?: tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()
        versionName = releaseVersionName
            ?: tauriProperties.getProperty("tauri.android.versionName", "1.0")
    }
    
    signingConfigs {
        if (releaseKeystore != null) {
            create("release") {
                // Named up front rather than left null. A keystore.properties
                // missing one line otherwise builds a signing config full of
                // nulls and fails deep inside AGP, saying nothing about which
                // property was absent. CI checks its secrets; this is the same
                // guarantee for a local build.
                fun required(name: String, env: String): String =
                    signingProperty(name, env)
                        ?: throw GradleException(
                            "Signing is configured but '$name' is missing. Set it in " +
                                "$keystoreDir/keystore.properties or pass $env.")

                storeFile = releaseKeystore
                storePassword = required("storePassword", "OC_ANDROID_KEYSTORE_PASSWORD")
                keyAlias = required("keyAlias", "OC_ANDROID_KEY_ALIAS")
                keyPassword = required("keyPassword", "OC_ANDROID_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        getByName("debug") {
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            isDebuggable = true
            isJniDebuggable = true
            isMinifyEnabled = false
            packaging {
                jniLibs.keepDebugSymbols.add("*/arm64-v8a/*.so")
                jniLibs.keepDebugSymbols.add("*/armeabi-v7a/*.so")
                // jniLibs.keepDebugSymbols.add("*/x86/*.so")
                // jniLibs.keepDebugSymbols.add("*/x86_64/*.so")
            }
        }
        getByName("release") {
            // The real release key when it is configured (see above), debug
            // otherwise so a local release build still works without it.
            signingConfig = signingConfigs.findByName("release")
                ?: signingConfigs.getByName("debug")
            isMinifyEnabled = true
            proguardFiles(
                *fileTree(".") { include("**/*.pro") }
                    .plus(getDefaultProguardFile("proguard-android-optimize.txt"))
                    .toList().toTypedArray()
            )
        }
    }
    
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlin {
        compilerOptions {
            jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
        }
    }
    
    buildFeatures {
        buildConfig = true
    }

    lint {
        disable += "NullSafeMutableLiveData"
        checkReleaseBuilds = false // Optional: skip all lint on release builds
    }
}

rust {
    rootDirRel = "../../../"
}

dependencies {
    implementation("androidx.webkit:webkit:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.13.0")
    implementation("androidx.lifecycle:lifecycle-process:2.10.0")
    implementation("com.google.android.material:material:1.13.0")

    // Firebase
    implementation(platform("com.google.firebase:firebase-bom:34.11.0"))
    implementation("com.google.firebase:firebase-analytics")
    implementation("com.google.firebase:firebase-messaging")
    implementation("com.google.firebase:firebase-common") 
    
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.7.0")
}

apply(from = "tauri.build.gradle.kts")

android.applicationVariants.all {
    if (buildType.name == "release") {
        outputs.all {
            val outputImpl = this as com.android.build.gradle.internal.api.BaseVariantOutputImpl
            // val buildTypeName = buildType.name.capitalize()
            // val flavorName = if (flavorName.isNotEmpty()) flavorName.capitalize() else ""
            // val versionName = versionName
            // val versionCode = versionCode

            outputImpl.outputFileName = "openchat-release.apk"
        }
    }
}

subprojects {
    afterEvaluate {
        tasks.withType<JavaCompile> {
            sourceCompatibility = JavaVersion.VERSION_17.toString()
            targetCompatibility = JavaVersion.VERSION_17.toString()
        }
        tasks.withType<KotlinJvmCompile> {
            compilerOptions {
                jvmTarget.set(JvmTarget.JVM_17)
            }
        }
    }
}