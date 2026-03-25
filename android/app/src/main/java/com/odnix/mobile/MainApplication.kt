package com.odnix.mobile
import com.odnix.mobile.BuildConfig

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader
import io.invertase.firebase.app.ReactNativeFirebaseAppPackage
import io.invertase.firebase.auth.ReactNativeFirebaseAuthPackage

class MainApplication : Application(), ReactApplication {

    override val reactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this) {
            override fun getPackages(): List<ReactPackage> {
                // Autolinking should normally register these packages.
                // However, some setups end up missing them (RNFBAppModule not found),
                // while other setups can double-register (override crash).
                // We only add them if they are not already present.
                val packages = PackageList(this).packages.toMutableList()

                if (packages.none { it is ReactNativeFirebaseAppPackage }) {
                    packages.add(ReactNativeFirebaseAppPackage())
                }
                if (packages.none { it is ReactNativeFirebaseAuthPackage }) {
                    packages.add(ReactNativeFirebaseAuthPackage())
                }

                return packages
            }

            override fun getJSMainModuleName(): String = "index"

            override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

            override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
            override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
        }

    override val reactHost: ReactHost
        get() = getDefaultReactHost(applicationContext, reactNativeHost)

    override fun onCreate() {
        super.onCreate()
        SoLoader.init(this, false)
        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
            load()
        }
    }
}
