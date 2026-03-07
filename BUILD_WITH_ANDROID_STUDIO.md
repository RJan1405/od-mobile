# Building Odnix Mobile in Android Studio

# (Alternative method when command line has network issues)

## Step 1: Open Project in Android Studio

1. Launch **Android Studio**
2. Click **Open** (or File → Open)
3. Navigate to: `D:\VulnTech11\react-odnix\odnix-mobile\android`
4. Click **OK**

## Step 2: Configure JDK

1. Android Studio will detect the project
2. If prompted about Gradle JDK, select **Embedded JDK (21)**
3. Click **OK**

## Step 3: Sync Project

1. Android Studio will show "Gradle sync" notification
2. Click **Sync Now** or **Try Again**
3. Wait for Gradle to download (Android Studio has better timeout handling)
4. This may take 5-10 minutes first time

## Step 4: Connect Your Phone

1. Make sure your phone is connected via USB
2. In Android Studio toolbar, you should see your device: **ZD222FVS6R**
3. If not listed, click the dropdown and select it

## Step 5: Build and Run

1. Click the **green play button** (▶️) in toolbar
2. OR click **Run** → **Run 'app'**
3. Android Studio will:
   - Build the APK (~5-10 min first time)
   - Install on your phone
   - Launch the app

## Step 6: If Build Fails

**Gradle Download Issues:**

- File → Settings → Build → Gradle
- Check "Offline mode" if Gradle already downloaded
- OR increase timeout: add to `gradle.properties`:

  ```
  systemProp.http.socketTimeout=600000
  systemProp.http.connectionTimeout=600000
  ```

**Java Version Issues:**

- File → Project Structure
- SDK Location → Gradle Settings
- Set "Gradle JDK" to "Embedded JDK (jbr-21)"

## Alternative: Manual APK Install

If Android Studio build works but install fails:

```powershell
# Find the APK
cd D:\VulnTech11\react-odnix\odnix-mobile\android\app\build\outputs\apk\debug

# Install manually
adb install app-debug.apk
```

## Faster Option: Use Expo CLI

If you want to test quickly without full build:

```powershell
cd D:\VulnTech11\react-odnix\odnix-mobile
npx expo start --tunnel
```

Then scan QR code with Expo Go app (but limited features as discussed).

---

**Recommendation**: Use Android Studio GUI - it handles network issues better than command line and gives you visual feedback on build progress.
