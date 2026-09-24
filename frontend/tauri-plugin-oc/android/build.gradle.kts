import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("com.google.devtools.ksp") version "2.2.0-2.0.2"
}

android {
    namespace = "com.ocplugin.app"
    compileSdk = 36

    buildFeatures {
        buildConfig = true
    }

    defaultConfig {
        minSdk = 21
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        consumerProguardFiles("consumer-rules.pro")
    }

    buildTypes {
        debug {
            // From a device, localhost is the device. A dev build can point avatars at the
            // Mac's nginx media proxy instead, e.g. OC_DEV_AVATAR_BASE_URL=http://192.168.1.5:8081/media-proxy/%s
            val avatarBase = System.getenv("OC_DEV_AVATAR_BASE_URL")?.takeIf { it.isNotBlank() }
                ?: "http://%s.raw.localhost:8080"
            buildConfigField("String", "AVATAR_BASE_URL", "\"$avatarBase\"")
        }
        release {
            buildConfigField("String", "AVATAR_BASE_URL", "\"https://%s.raw.icp0.io\"")
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlin {
        compilerOptions {
            jvmTarget.set(JvmTarget.JVM_17)
        }
    }

    // JVM unit tests for the pure call rules (src/test). android.util.Log calls in the
    // code under test return defaults instead of throwing; no Robolectric.
    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.18.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("com.google.android.material:material:1.13.0")

    implementation(project(":tauri-android"))

    implementation("androidx.credentials:credentials:1.6.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.6.0")
    implementation("com.google.android.gms:play-services-auth:21.5.1")

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.10.2")

    implementation("androidx.browser:browser:1.10.0")

    implementation(platform("com.google.firebase:firebase-bom:34.12.0"))
    implementation("com.google.firebase:firebase-messaging")

    implementation("io.coil-kt.coil3:coil:3.4.0")
    implementation("io.coil-kt.coil3:coil-network-okhttp:3.4.0")

    val roomVersion = "2.8.4"
    implementation("androidx.room:room-runtime:$roomVersion")
    ksp("androidx.room:room-compiler:$roomVersion")
    implementation("androidx.room:room-ktx:$roomVersion")

    // Test dependencies
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.7.0")
}
