# odnix-mobile Setup Guide

This guide explains how to set up odnix-mobile after transferring the project folder to a new location.

## Prerequisites

- Node.js and npm installed
- Android Studio installed (with Android SDK)

## Setup Steps

1. **Install JavaScript Dependencies**
   - Open a terminal in the project root.
   - Run:

     ```sh
     npm install
     ```

2. **Android Studio & Gradle Setup**
   - Open the `android/` folder in Android Studio.
   - Let Android Studio sync Gradle and download dependencies.
   - Ensure `local.properties` in `android/` points to your Android SDK location (Android Studio usually sets this automatically).

3. **Build the Project**
   - From the project root or `android/` folder, run:

     ```sh
     ./android/gradlew assembleDebug
     ```

     or on Windows:

     ```bat
     .\android\gradlew.bat assembleDebug
     ```

4. **Run Setup Scripts (Optional)**
   - Run any setup scripts as needed:
     - `setup.bat`
     - `setup-ports.bat`
     - `quick-build.bat`

5. **Start Metro Bundler**
   - In the project root, run:

     ```sh
     npx react-native start
     ```

     or

     ```sh
     npm start
     ```

6. **Build and Run the App**
   - For Android:

     ```sh
     npx react-native run-android
     ```

     or use Android Studio to run on a device/emulator.

## Additional Information

- Check `README.md`, `QUICKSTART.md`, and `BUILD_WITH_ANDROID_STUDIO.md` for more details.
- If you encounter issues, ensure all dependencies are installed and environment variables are set correctly.

---

_Last updated: March 13, 2026_
