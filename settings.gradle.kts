pluginManagement {
    includeBuild("build-logic")
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

// Bouncy Castle arrives through the Android Gradle plugin; 1.80.2 has GHSA-9pwp-9qqc-pr26 and GHSA-qp49-qgx5-5m26.
// Remove once AGP ships 1.85 or newer.
buildscript {
    repositories { mavenCentral() }
    dependencies {
        constraints {
            listOf("bcprov", "bcpkix", "bcutil").forEach {
                classpath(
                    "org.bouncycastle:$it-jdk18on:1.85",
                ) { because("fixes GHSA-9pwp-9qqc-pr26, GHSA-qp49-qgx5-5m26") }
            }
        }
    }
}

plugins {
    // Downloads the JDK 17 toolchain when it is not installed locally.
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
    }
}

rootProject.name = "Vesper"

include(":app")
include(":kids")
include(":core:model")
include(":core:ui")
include(":core:navigation")
include(":core:data")
include(":core:usage")
include(":core:blocking")
include(":core:sync")
include(":core:testing")
include(":feature:onboarding")
include(":feature:home")
include(":feature:block")
include(":feature:devices")
include(":feature:insights")
include(":feature:account")
