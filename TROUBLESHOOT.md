```bash
/home/bikice/Android/Sdk/emulator/emulator @Pixel_9a -gpu swiftshader_indirect
```

```bash
$ sudo uname -a
Linux zero-cool 6.14.0-37-generic #37-Ubuntu SMP PREEMPT_DYNAMIC Fri Nov 14 22:10:32 UTC 2025 x86_64 x86_64 x86_64 GNU/Linux

$ sudo lsb_release -a
No LSB modules are available.
Distributor ID:    Ubuntu
Description:    Ubuntu 25.04
Release:    25.04
Codename:    plucky

$ /home/bikice/Android/Sdk/emulator/emulator --version                          
INFO         | Android emulator version 36.6.11.0 (build_id 15507667) (CL:N/A)
INFO         | Graphics backend: gfxstream
ERROR        | No AVD specified. Use '@foo' or '-avd foo' to launch a virtual device named 'foo'

$ /home/bikice/Android/Sdk/emulator/emulator @Pixel_9a -gpu swiftshader_indirect
INFO         | Android emulator version 36.6.11.0 (build_id 15507667) (CL:N/A)
INFO         | Graphics backend: gfxstream
INFO         | Found systemPath /home/bikice/Android/Sdk/system-images/android-36/google_apis/x86_64/
INFO         | Guest usage of host flag 'VulkanVirtualQueue' will be ignored.
INFO         | Feature 'Vulkan' (21) is overridden to 'disabled'
INFO         | Increasing RAM size to 2560MB
INFO         | Guest GLES Driver: Auto (ext controls)
INFO         | emuglConfig_init: vulkan_mode_selected:swiftshader gles_mode_selected:swiftshader
INFO         | Checking system compatibility:
INFO         |   Checking: hasSufficientDiskSpace
INFO         |      Ok: Disk space requirements to run avd: `Pixel_9a` are met
INFO         |   Checking: hasSufficientHwGpu
INFO         |      Ok: Hardware GPU compatibility checks are not required
INFO         |   Checking: hasSufficientSystem
INFO         |      Ok: System requirements to run avd: `Pixel_9a` are met
WARNING      | Feature QuickbootFileBacked is disabled due to stability issues, if you really want that, the environment variable ANDROID_EMU_FORCE_QUICKBOOT_FILE_BACKED need to set to 1
ERROR        | x86_64 emulation currently requires hardware acceleration!
CPU acceleration status: /dev/kvm is not found: VT disabled in BIOS or KVM kernel module not loaded
More info on configuring VM acceleration on Linux:
https://developer.android.com/studio/run/emulator-acceleration#vm-linux
General information on acceleration: https://developer.android.com/studio/run/emulator-acceleration.

$ ls -l /dev/kvm
ls: Zugriff auf '/dev/kvm' nicht möglich: Datei oder Verzeichnis nicht gefunden

$ groups $USER

bikice : bikice adm cdrom sudo dip video plugdev users kvm render lpadmin vboxusers docker ollama

$ egrep -c '(vmx|svm)' /proc/cpuinfo
16

$ systemd-detect-virt
none

$ lsmod | grep kvm

$ sudo modprobe kvm_amd 

$ echo "kvm_amd" | sudo tee /etc/modules-load.d/kvm.conf
kvm_amd

$ modinfo kvm_amd | head -5
filename:       /lib/modules/6.14.0-37-generic/kernel/arch/x86/kvm/kvm-amd.ko.zst
license:        GPL
description:    KVM support for SVM (AMD-V) extensions
author:         Qumranet
srcversion:     7FBC8B8E28A72BD42D2C28C

$ sudo dmesg | tail -30
[  475.573461] vethc766776: entered allmulticast mode
[  475.573520] vethc766776: entered promiscuous mode
[  475.588260] eth0: renamed from veth5eeaeb6
[  475.588794] br-11a15d936a91: port 1(vethc766776) entered blocking state
[  475.588800] br-11a15d936a91: port 1(vethc766776) entered forwarding state
[  480.747821] br-11a15d936a91: port 1(vethc766776) entered disabled state
[  480.747908] veth5eeaeb6: renamed from eth0
[  480.780112] br-11a15d936a91: port 1(vethc766776) entered disabled state
[  480.780426] vethc766776 (unregistering): left allmulticast mode
[  480.780432] vethc766776 (unregistering): left promiscuous mode
[  480.780437] br-11a15d936a91: port 1(vethc766776) entered disabled state
[  540.803796] br-11a15d936a91: port 1(veth1ed5775) entered blocking state
[  540.803804] br-11a15d936a91: port 1(veth1ed5775) entered disabled state
[  540.803816] veth1ed5775: entered allmulticast mode
[  540.803902] veth1ed5775: entered promiscuous mode
[  540.818447] eth0: renamed from vethcf755f4
[  540.818911] br-11a15d936a91: port 1(veth1ed5775) entered blocking state
[  540.818918] br-11a15d936a91: port 1(veth1ed5775) entered forwarding state
[  545.977820] br-11a15d936a91: port 1(veth1ed5775) entered disabled state
[  545.977871] vethcf755f4: renamed from eth0
[  546.011432] br-11a15d936a91: port 1(veth1ed5775) entered disabled state
[  546.011727] veth1ed5775 (unregistering): left allmulticast mode
[  546.011733] veth1ed5775 (unregistering): left promiscuous mode
[  546.011738] br-11a15d936a91: port 1(veth1ed5775) entered disabled state
[  555.558438] kvm_amd: TSC scaling supported
[  555.558442] kvm_amd: Nested Virtualization enabled
[  555.558444] kvm_amd: Nested Paging enabled
[  555.558445] kvm_amd: LBR virtualization supported
[  555.558450] kvm_amd: Virtual VMLOAD VMSAVE supported
[  555.558451] kvm_amd: Virtual GIF supported
```
