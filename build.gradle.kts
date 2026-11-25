// Transitive build-tool dependencies with published advisories are pinned to patched versions (all versions live in
// gradle/libs.versions.toml). The version-catalog accessor is not available in this block, so it reads the file directly.
// Bouncy Castle (Android Gradle plugin), FreeMarker (Kover), Guava, jose4j, jdom2, commons-lang3, httpclient.
// Remove each pin once the tool that pulls it in ships a fixed version.
buildscript {
    val catalog = file("gradle/libs.versions.toml").readLines()

    fun catalogVersion(key: String): String =
        catalog
            .first { it.startsWith("$key = ") }
            .substringAfter('"')
            .substringBefore('"')
    dependencies {
        constraints {
            listOf("bcprov", "bcpkix", "bcutil").forEach {
                classpath("org.bouncycastle:$it-jdk18on:${catalogVersion("bouncycastle")}") {
                    because("fixes GHSA-9pwp-9qqc-pr26, GHSA-qp49-qgx5-5m26")
                }
            }
            classpath(
                "org.freemarker:freemarker:${catalogVersion("freemarker")}",
            ) { because("fixes GHSA-27j2-h3m2-8237") }
            classpath("com.google.guava:guava:${catalogVersion("guava")}-jre") { because("fixes GHSA-xxph-c9ww-hj94") }
            classpath("org.bitbucket.b_c:jose4j:${catalogVersion("jose4j")}") { because("fixes GHSA-3677-xxcr-wjqv") }
            classpath("org.jdom:jdom2:${catalogVersion("jdom2")}") { because("fixes GHSA-2363-cqg2-863c") }
            classpath(
                "org.apache.commons:commons-lang3:${catalogVersion("commonsLang3")}",
            ) { because("fixes GHSA-j288-q9x7-2f5v") }
            classpath("org.apache.httpcomponents:httpclient:${catalogVersion("httpclient")}") {
                because("fixes GHSA-7r82-7xv7-xcpj")
            }
        }
    }
}

// Plugins are declared here (not applied) so every module shares one plugin classpath.
plugins {
    id("vesper.manifest-audit")
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.ksp) apply false
    alias(libs.plugins.hilt) apply false
    alias(libs.plugins.google.services) apply false
    alias(libs.plugins.roborazzi) apply false
    alias(libs.plugins.spotless)
    alias(libs.plugins.detekt)
    alias(libs.plugins.kover)
}

// ---------------------------------------------------------------------------------------------
// Code quality: Spotless (ktlint + Compose rules), detekt, Kover, Roborazzi. See docs: CI = ciCheck.
// ---------------------------------------------------------------------------------------------

spotless {
    kotlin {
        target("**/*.kt")
        targetExclude("**/build/**", "**/.gradle/**", "**/.claude/**")
        ktlint(libs.versions.ktlint.get())
            .customRuleSets(
                listOf(
                    libs.compose.rules.ktlint
                        .get()
                        .let { "${it.module}:${it.versionConstraint.requiredVersion}" },
                ),
            )
    }
    kotlinGradle {
        target("**/*.gradle.kts")
        targetExclude("**/build/**", "**/.gradle/**", "**/.claude/**")
        ktlint(libs.versions.ktlint.get())
    }
}

detekt {
    buildUponDefaultConfig = true
    config.setFrom(file("config/detekt/detekt.yml"))
    baseline = file("config/detekt/baseline.xml")
    source.setFrom(
        files(rootDir).asFileTree.matching {
            include("**/src/**/*.kt")
            exclude("**/build/**", "**/.claude/**")
        },
    )
    parallel = true
}

tasks.withType<dev.detekt.gradle.Detekt>().configureEach {
    jvmTarget = "17"
    reports {
        html.required = true
        sarif.required = true
        checkstyle.required = false
        markdown.required = false
    }
}

subprojects {
    // Modules are still empty skeletons; drop this once every module has tests.
    tasks.withType<Test>().configureEach { failOnNoDiscoveredTests = false }

    apply(plugin = "org.jetbrains.kotlinx.kover")
    rootProject.dependencies.add("kover", this)

    // Roborazzi: `recordRoborazziDebug` locally, `verifyRoborazziDebug` in CI.
    plugins.withId("com.android.library") { apply(plugin = "io.github.takahirom.roborazzi") }
    plugins.withId("com.android.application") { apply(plugin = "io.github.takahirom.roborazzi") }

    extensions.configure<kotlinx.kover.gradle.plugin.dsl.KoverProjectExtension> {
        reports.filters.excludes { excludeFromCoverage() }
        // Minimum line coverage for the logic modules (the overall 60% bound is in the root `kover` block).
        if (path == ":core:model" || path == ":core:blocking") {
            reports.verify.rule("Logic line coverage") { minBound(80) }
        }
    }
}

kover {
    reports {
        filters.excludes { excludeFromCoverage() }
        verify.rule("Overall line coverage") { minBound(60) }
    }
}

// Android entry points, generated code and previews are covered by UI/screenshot/E2E tests, not line coverage.
// Applied to the merged report (root) and to every module's own report, which the per-module bounds use.
fun kotlinx.kover.gradle.plugin.dsl.KoverReportFilter.excludeFromCoverage() {
    classes(
        "*.BuildConfig",
        "*.R",
        "*.R$*",
        "*ComposableSingletons*",
        "*_Factory",
        "*_Factory$*",
        "*_HiltModules*",
        "*_MembersInjector",
        "Hilt_*",
        "*.Hilt_*",
        "dagger.hilt.*",
        "hilt_aggregated_deps.*",
        // Plain data holders in :core:model (no logic; their generated members are not worth testing).
        // Logic types (DaysOfWeek, TimeRange, DialConfig, KnownApps, formatters) stay covered. Add new data holders here.
        "com.dculus.vesper.core.model.AppInfo",
        "com.dculus.vesper.core.model.AppUsage",
        "com.dculus.vesper.core.model.Block",
        "com.dculus.vesper.core.model.BlockSource",
        "com.dculus.vesper.core.model.BlockTarget*",
        "com.dculus.vesper.core.model.BlockType",
        "com.dculus.vesper.core.model.BreakSession",
        "com.dculus.vesper.core.model.DayUsage",
        "com.dculus.vesper.core.model.FocusSession",
        "com.dculus.vesper.core.model.LimitPeriod",
        "com.dculus.vesper.core.model.LinkedDevice",
        "com.dculus.vesper.core.model.LockedApp",
        "com.dculus.vesper.core.model.Permissions",
        "com.dculus.vesper.core.model.TamperAlert",
        "com.dculus.vesper.core.model.TamperKind",
        "com.dculus.vesper.core.model.TemporaryAllowance",
        "com.dculus.vesper.core.model.UnlockRequest*",
        "com.dculus.vesper.core.testing.HiltTestRunner", // instrumented-test harness, runs on devices only
        "com.dculus.vesper.core.testing.ScreenshotOnFailureRule",
        "com.dculus.vesper.core.testing.ScenarioCleanupRule",
        "*.Placeholder", // empty module placeholders; delete this line when the modules get real code
        // Android adapters in :core:blocking (system service, Settings/PackageManager lookups); the logic they
        // delegate to (ForegroundAppTracker, AccessibilityStatus.isEnabled decision) is unit-tested.
        "com.dculus.vesper.core.blocking.ForegroundAppService*",
        "com.dculus.vesper.core.blocking.standard.BlockingService", // like ForegroundAppService: lifecycle glue
        "com.dculus.vesper.core.blocking.AndroidForegroundEnvironment",
        // Block screen UI and window plumbing (Activity, Compose host, accessibility overlay, launcher): covered by
        // the manual/E2E checks; its logic (BlockCountdown, BlockRequest, decision source) is unit-tested.
        "com.dculus.vesper.core.blocking.screen.BlockActivity",
        "com.dculus.vesper.core.blocking.screen.BlockActivity$*",
        "com.dculus.vesper.core.blocking.screen.BlockHostKt*",
        "com.dculus.vesper.core.blocking.screen.BlockScreenKt*",
        "com.dculus.vesper.core.blocking.screen.BlockScreenLauncher*",
        "com.dculus.vesper.core.blocking.screen.BlockScreenState",
        "com.dculus.vesper.core.blocking.screen.BlockScreenModule",
        "com.dculus.vesper.core.blocking.screen.BlockOverlayWindow*",
        // Usage-warning overlay (window, views, animations); when it fires is RuleEvaluator.usageWarnings, tested.
        "com.dculus.vesper.core.blocking.screen.UsageWarningPill*",
        "com.dculus.vesper.core.blocking.screen.EdgeGlowView",
        "com.dculus.vesper.core.blocking.screen.WarningPalette*",
        // App timer tab overlay (window, views, drag, animations); when it shows is BlockingEngine and
        // RuleEvaluator.tightestBudget, and its time formatting (AppTimerChipKt) is unit-tested.
        "com.dculus.vesper.core.blocking.screen.AppTimerChip",
        "com.dculus.vesper.core.blocking.screen.AppTimerChip$*",
        "com.dculus.vesper.core.blocking.screen.AccessibilitySurface",
        "com.dculus.vesper.core.blocking.screen.BlockSurfaceKt",
        "com.dculus.vesper.core.blocking.engine.ScreenAndClockReceivers*", // registers system broadcasts
        "com.dculus.vesper.core.blocking.screen.BackAwareFrame",
        "*.MainActivity",
        "*.VesperApp",
        "*.VesperKidsApp",
        "com.dculus.vesper.core.blocking.standard.AndroidInteractiveScreen*", // broadcast adapter
        "com.dculus.vesper.core.usage.AndroidResumeEventReader", // UsageStatsManager adapter
        "*.AppCheckInstaller", // thin Firebase SDK glue; the availability gate it relies on is unit-tested
        "*.AppCheckProviders",
    )
    annotatedBy("androidx.compose.ui.tooling.preview.Preview", "javax.annotation.processing.Generated")
}

// Aggregates so CI jobs and `ciCheck` run the same thing. Android modules use `lint`/`testDebugUnitTest`,
// JVM modules use `test`.
val lintAll = tasks.register("lintAll") { group = "verification" }
val unitTests = tasks.register("unitTests") { group = "verification" }
val verifyScreenshots = tasks.register("verifyScreenshots") { group = "verification" }

// The convention plugins' own tests (version scheme) live in the included build-logic build.
unitTests { dependsOn(gradle.includedBuild("build-logic").task(":convention:test")) }

subprojects {
    plugins.withId("com.android.library") { registerAndroidQualityTasks() }
    plugins.withId("com.android.application") { registerAndroidQualityTasks() }
    plugins.withId("org.jetbrains.kotlin.jvm") {
        rootProject.tasks.named("unitTests") { dependsOn(tasks.named("test")) }
    }
}

fun Project.registerAndroidQualityTasks() {
    rootProject.tasks.named("lintAll") { dependsOn(tasks.named("lint")) }
    rootProject.tasks.named("unitTests") { dependsOn(tasks.named("testDebugUnitTest")) }
    rootProject.tasks.named("verifyScreenshots") { dependsOn(tasks.named("verifyRoborazziDebug")) }
}

// Everything the CI jobs run, locally: the Definition-of-done command.
tasks.register("ciCheck") {
    group = "verification"
    description =
        "Runs spotlessCheck, detekt, lint, unit tests, Kover verification, screenshot tests and assembleDebug."
    dependsOn(
        "spotlessCheck",
        "detekt",
        checkFeatureIsolation,
        "verifyManifests",
        lintAll,
        unitTests,
        "koverXmlReport",
        "koverVerify",
        verifyScreenshots,
    )
    // Per-module coverage bounds (80% for the logic modules) live on the module tasks, not the root one.
    dependsOn(":core:model:koverVerify", ":core:blocking:koverVerify")
    dependsOn(subprojects.filter { it.path == ":app" || it.path == ":kids" }.map { "${it.path}:assembleDebug" })
}

// Feature modules must never depend on each other; they may only use :core:* modules.
val featureIsolationViolations = mutableListOf<String>()

gradle.projectsEvaluated {
    subprojects
        .filter { it.path.startsWith(":feature:") }
        .forEach { feature ->
            feature.configurations.forEach { configuration ->
                configuration.dependencies
                    .filterIsInstance<ProjectDependency>()
                    .map { it.path }
                    .filter { it.startsWith(":feature:") && it != feature.path }
                    .forEach { featureIsolationViolations += "${feature.path} -> $it (${configuration.name})" }
            }
        }
}

val checkFeatureIsolation =
    tasks.register("checkFeatureIsolation") {
        group = "verification"
        description = "Fails if a :feature:* module depends on another :feature:* module."
        val violations = featureIsolationViolations
        doLast {
            check(violations.isEmpty()) {
                "Feature modules must not depend on each other:\n" + violations.joinToString("\n")
            }
        }
    }

tasks.named("check") {
    dependsOn(checkFeatureIsolation)
}

// The same security pins for every module's own configurations (the buildscript block at the top covers the build classpath).
// Android lint's tool classpath brings Bouncy Castle 1.80.2; some libraries still bring Guava 32.x (keep the -android / -jre flavour).
val bouncycastle = libs.versions.bouncycastle.get()
val guava = libs.versions.guava.get()
val pins =
    mapOf(
        "org.bitbucket.b_c:jose4j" to libs.versions.jose4j.get(),
        "org.jdom:jdom2" to libs.versions.jdom2.get(),
        "org.apache.commons:commons-lang3" to libs.versions.commonsLang3.get(),
        "org.apache.httpcomponents:httpclient" to libs.versions.httpclient.get(),
    )
subprojects {
    configurations.configureEach {
        resolutionStrategy.eachDependency {
            val module = "${requested.group}:${requested.name}"
            when {
                requested.group == "org.bouncycastle" && requested.name.endsWith("-jdk18on") -> {
                    useVersion(bouncycastle)
                    because("fixes GHSA-9pwp-9qqc-pr26, GHSA-qp49-qgx5-5m26")
                }

                module == "com.google.guava:guava" -> {
                    useVersion("$guava-${if (requested.version.orEmpty().endsWith("-android")) "android" else "jre"}")
                    because("fixes GHSA-xxph-c9ww-hj94")
                }

                module in pins -> {
                    useVersion(pins.getValue(module))
                    because("fixes a published advisory (high or medium)")
                }
            }
        }
    }
}
