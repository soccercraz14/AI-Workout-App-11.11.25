# 📱 Adding Your Custom App Icon

## Quick Method (Easiest)

### 1. Generate Icon Assets

Use an online tool to generate all required iOS icon sizes:

**Recommended Tool:** https://www.appicon.co/

1. Upload your logo (1024x1024 PNG recommended, must be square)
2. Select "iOS" only
3. Download the generated assets

### 2. Add Icons to Xcode

1. **Open Xcode** (if not already open):
   ```bash
   cd ~/AI-Workout-App-11.11.25
   open ios/App/App.xcworkspace
   ```

2. **In Xcode**, navigate to:
   - Left sidebar → Click "App" (blue icon at top)
   - Left panel → Click "App" folder
   - Click on "Assets" (or "Assets.xcassets")
   - Click "AppIcon"

3. **Drag and drop** your generated icon files into the corresponding slots:
   - iPhone App: 60pt @2x (120x120), 60pt @3x (180x180)
   - iPad App: 76pt @2x (152x152), 83.5pt @2x (167x167)
   - App Store: 1024pt @1x (1024x1024)

4. **Build and run** - Your icon should now appear on your iPhone home screen!

---

## Advanced Method (Using Capacitor Assets Tool)

### 1. Prepare Your Icon

Create a single 1024x1024 PNG file named `icon.png` and place it in the project root.

### 2. Install Icon Generator

```bash
npm install -g @capacitor/assets
```

### 3. Generate All Sizes

```bash
cd ~/AI-Workout-App-11.11.25
npx @capacitor/assets generate --iconForeground icon.png
```

### 4. Sync and Rebuild

```bash
npx cap sync ios
npm run ios
```

---

## Manual Method (For Custom Control)

### Required Icon Sizes for iOS:

| Device        | Size (px)  | Filename Pattern      |
|---------------|------------|-----------------------|
| iPhone        | 120x120    | icon-60@2x.png       |
| iPhone        | 180x180    | icon-60@3x.png       |
| iPad          | 152x152    | icon-76@2x.png       |
| iPad Pro      | 167x167    | icon-83.5@2x.png     |
| App Store     | 1024x1024  | icon-1024.png        |

### Steps:

1. Create all icon sizes from your logo
2. In Xcode, navigate to: `App → Assets.xcassets → AppIcon`
3. Drag each icon to its corresponding slot
4. Rebuild the app

---

## Tips:

- ✅ **Use PNG format** with transparency removed (solid background)
- ✅ **Keep it simple** - Small details won't be visible
- ✅ **Square aspect ratio** - Will be rounded by iOS automatically
- ✅ **High contrast** - Make sure icon is visible on both light and dark backgrounds
- ❌ Don't include rounded corners (iOS adds them)
- ❌ Don't include text smaller than 6pt

---

## Testing Your Icon:

After adding your icon:
1. Clean build folder in Xcode: Product → Clean Build Folder (⇧⌘K)
2. Delete the app from your iPhone
3. Rebuild and install from Xcode
4. Your new icon should appear on the home screen!

---

## Troubleshooting:

**Icon not updating?**
- Delete the app from your iPhone completely
- Clean build folder in Xcode
- Rebuild and reinstall

**Wrong icon showing?**
- Make sure all icon slots are filled in Xcode
- Check that images are exactly the right pixel dimensions
- Verify iOS deployment target matches your device
