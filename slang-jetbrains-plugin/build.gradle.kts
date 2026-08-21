import org.jetbrains.intellij.platform.gradle.TestFrameworkType
import org.jetbrains.intellij.platform.gradle.tasks.aware.SplitModeAware
plugins {
    id("org.jetbrains.intellij.platform")
}
dependencies {
    intellijPlatform {
        webstorm("2026.2")
        bundledPlugin("JavaScript")
        testFramework(TestFrameworkType.Platform)
    }
}

intellijPlatform {
    splitMode = true
    pluginInstallationTarget = SplitModeAware.PluginInstallationTarget.BOTH
}