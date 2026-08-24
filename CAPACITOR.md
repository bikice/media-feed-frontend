# MediaFeed — Android / Capacitor Dev Notes

Reference notes for building `mediafeed-app` to Android via Capacitor:
starting the emulator, connecting real/virtual devices over USB and Wi-Fi,
and syncing + running the app.

## Contents

- [Emulator](#emulator)
  - [Start the emulator](#start-the-emulator)
  - [Troubleshooting: KVM blacklisted](#troubleshooting-kvm-blacklisted)
- [Connecting devices](#connecting-devices)
  - [Android phone via USB cable](#android-phone-via-usb-cable)
  - [Fire TV via ADB (Wi-Fi)](#fire-tv-via-adb-wi-fi)
  - [Android phone via Wi-Fi (pair & connect)](#android-phone-via-wi-fi-pair--connect)
- [Build, sync, and run](#build-sync-and-run)
  - [Sync web assets into the native project](#sync-web-assets-into-the-native-project)
  - [Run in the emulator](#run-in-the-emulator)
  - [Install on a physical or networked device](#install-on-a-physical-or-networked-device)

---

## Emulator

### Start the emulator

```sh
$ ~/Android/Sdk/emulator/emulator @Pixel_9a -gpu swiftshader_indirect
$ adb devices
List of devices attached
emulator-5554	device
```

`-gpu swiftshader_indirect` forces software rendering — useful when hardware
GL passthrough is flaky or unavailable, at some cost to graphics performance.
Drop the flag once you've confirmed host GPU acceleration works.

### Troubleshooting: KVM blacklisted

Symptom: the emulator refuses to start (or falls back to a very slow
software-only mode) because `/dev/kvm` isn't available.

Check whether `kvm`/`kvm_amd` (or `kvm_intel`) is blacklisted:

```sh
$ grep -r kvm /etc/modprobe.d/ /usr/lib/modprobe.d/ /lib/modprobe.d/ 2>/dev/null
/etc/modprobe.d/blacklist:blacklist kvm
/etc/modprobe.d/blacklist:blacklist kvm_amd
/etc/modprobe.d/blacklist-kvm.conf:blacklist kvm
/etc/modprobe.d/blacklist-kvm.conf:blacklist kvm_amd
```

If it's blacklisted (often pulled in by VirtualBox's `vboxdrv` install,
which conflicts with KVM), load it explicitly and make it persist across
reboots:

```sh
$ sudo modprobe kvm_amd
$ echo kvm_amd | sudo tee /etc/modules-load.d/kvm.conf
$ cat /etc/modules-load.d/kvm.conf
kvm_amd
```

Confirm it loaded:

```sh
$ journalctl -b | grep -i kvm
kernel: kvm_amd: TSC scaling supported
kernel: kvm_amd: Nested Virtualization enabled
kernel: kvm_amd: Nested Paging enabled
kernel: kvm_amd: LBR virtualization supported
kernel: kvm_amd: Virtual VMLOAD VMSAVE supported
kernel: kvm_amd: Virtual GIF supported
```

> **Note:** VirtualBox's kernel modules (`vboxdrv`, `vboxnetflt`,
> `vboxnetadp`) and KVM can coexist on modern kernels but have historically
> conflicted. If KVM acceleration still doesn't stick after a reboot, check
> whether `vboxdrv` is re-blacklisting it:
> ```sh
> $ lsmod | grep vbox
> vboxnetadp             28672  0
> vboxnetflt             36864  0
> vboxdrv               720896  2 vboxnetadp,vboxnetflt
> ```

---

## Connecting devices

### Android phone via USB cable

1. Enable **Developer options** (Settings → About phone → tap *Build
   number* 7 times) and turn on **USB debugging**.
2. Plug in the cable, accept the "Allow USB debugging?" prompt on the
   phone.
3. Verify:

```sh
$ adb devices
List of devices attached
4A161JEBF11958	device
```

### Fire TV via ADB (Wi-Fi)

Fire TV / Fire TV Stick only exposes ADB over the network (enable
**Settings → My Fire TV → Developer options → ADB debugging** and note the
device's IP first):

```sh
$ adb connect 192.168.188.100
$ adb devices
List of devices attached
192.168.188.100:5555	device
```

If the connection drops (common after the device sleeps), just re-run
`adb connect <ip>`. To disconnect cleanly: `adb disconnect 192.168.188.100`.

### Android phone via Wi-Fi (pair & connect)

For a phone (not Fire TV) this uses **Wireless debugging** (Android 11+),
which requires an initial pairing step over a *different* ephemeral port
before you can `adb connect` on the stable debugging port.

1. On the phone: **Settings → Developer options → Wireless debugging** →
   turn it on.
2. Tap **Pair device with pairing code**. This shows an IP:port and a
   6-digit code, e.g. `192.168.188.42:41235` / `123456`.
3. On the host:

```sh
$ adb pair 192.168.188.42:41235
Enter pairing code: 123456
Successfully paired to 192.168.188.42:41235 [guid=...]
```

4. Back on the **Wireless debugging** main screen (not the pairing dialog),
   note the *separate* IP:port shown there — this is the stable debugging
   port, different from the pairing port:

```sh
$ adb connect 192.168.188.42:37891
connected to 192.168.188.42:37891
$ adb devices
List of devices attached
192.168.188.42:37891	device
```

Pairing only needs to be done once per host/phone combo as long as
Wireless debugging stays enabled; after that, a plain `adb connect
<ip>:<port>` is enough (the port can change if the phone reboots or
Wi-Fi reconnects — re-check the Wireless debugging screen if `connect`
fails).

---

## Build, sync, and run

> **⚠️ Before building for a real device (emulator or physical):** check
> `.env` and make sure `VITE_API_PROXY_TARGET` / `VITE_API_BASE_URL` point
> at the **production** backend, not `localhost:8080`. The dev proxy in
> `vite.config.ts` only applies to `npm run dev` — a `npm run build` /
> `cap sync` bundles whatever `.env` says at build time directly into the
> app, and a phone/emulator/Fire TV can't reach your machine's `localhost`
> anyway.

### Sync web assets into the native project

Run after any change to web code, or after installing/updating Capacitor
plugins. This copies `dist/` into the Android project and re-applies native
config:

```sh
$ npm run build     # tsc -b && vite build
$ npx cap sync
✔ Copying web assets from dist to android/app/src/main/assets/public in 12.79ms
✔ Creating capacitor.config.json in android/app/src/main/assets in 552.60μs
✔ copy android in 21.02ms
✔ Updating Android plugins in 1.53ms
✔ update android in 19.45ms
✔ copy web in 3.25ms
✔ update web in 3.43ms
[info] Sync finished in 0.065s
```

### Run in the emulator

`cap run` does an implicit sync, builds the debug APK with Gradle, and
deploys straight to a chosen target:

```sh
$ npx cap run android
✔ Copying web assets from dist to android/app/src/main/assets/public in 11.83ms
✔ Creating capacitor.config.json in android/app/src/main/assets in 678.73μs
[info] Inlining sourcemaps
✔ copy android in 21.62ms
✔ Updating Android plugins in 1.56ms
✔ update android in 14.41ms
✔ Please choose a target device: › Pixel 9a (emulator) (Pixel_9a)
✔ Running Gradle build in 951.44ms
✔ Deploying app-debug.apk to Pixel_9a in 1.68s
```

If only one device/emulator is attached, `cap run android` skips the
picker; use `npx cap run android --target Pixel_9a` (or the device serial,
e.g. `--target 4A161JEBF11958`) to skip it explicitly in scripts.

### Install on a physical or networked device

With a phone connected (USB or Wi-Fi, per above) and showing up in
`adb devices`, `cap run android` works exactly the same way — it will list
every connected target, including USB phones, Wi-Fi-paired phones, and the
Fire TV, and install to whichever you pick:

```sh
$ npx cap run android
...
✔ Please choose a target device: › 4A161JEBF11958 (Pixel phone)
...
✔ Deploying app-debug.apk to 4A161JEBF11958 in 2.1s
```

Alternative: build once and install the APK manually (useful for
sideloading onto multiple devices, or the Fire TV, without rebuilding each
time):

```sh
$ cd android && ./gradlew assembleDebug
$ adb -s 192.168.188.100:5555 install -r app/build/outputs/apk/debug/app-debug.apk
```

`-r` reinstalls over an existing install, keeping app data.

**First-time install checklist for a fresh device:**
- Developer options + USB/Wireless debugging enabled (see above).
- On some OEM ROMs (Fire TV especially), **Settings → security → Apps
  from unknown sources** must allow installs via ADB/the installing app.
- If `androidScheme: 'https'` is left as-is (the current
  `capacitor.config.ts`) and `VITE_API_BASE_URL` points at a plain
  `http://` backend, the WebView will block those requests. Either put a
  real TLS cert on the backend, or uncomment `cleartext: true` in
  `capacitor.config.ts` for local-only testing.
