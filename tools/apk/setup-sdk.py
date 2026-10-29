#!/usr/bin/env python3
"""Fetch the official Android 34 platform and Build Tools 34 needed to rebuild PULSE.

Run from tools/apk/: python3 setup-sdk.py
SDK files live in /tmp by default; SHA-1 is checked against Google's SDK repository index.
The signed APK contains none of these tools. Java 11 and PIL for the icon are required.
"""
import hashlib
import os
from pathlib import Path
from urllib.request import urlopen
from zipfile import ZipFile

HERE = Path(__file__).resolve().parent
SDK = Path(os.environ.get("PULSE_ANDROID_SDK", "/tmp/pulse-mbbs-android-sdk"))
DLS = SDK / "downloads"
URL = "https://dl.google.com/android/repository/"
PKGS = [
    ("platform-34-ext7_r03.zip", "1f2e9478d6a7601425ceaa553311dc43191f103d"),
    ("build-tools_r34-linux.zip", "d6d58e0c6925a9e4d9a541e84cd1f405c2f9d2a9"),
]
PLATFORM = ["android-34/android.jar"]
TOOLS = [
    "android-14/aapt", "android-14/aapt2", "android-14/d8", "android-14/apksigner",
    "android-14/zipalign", "android-14/lib/d8.jar", "android-14/lib/apksigner.jar",
    "android-14/lib64/libc++.so", "android-14/lib64/libc++.so.1",
]


def get_zip(name, sha1):
    DLS.mkdir(parents=True, exist_ok=True)
    dest = DLS / name
    if dest.exists() and hashlib.sha1(dest.read_bytes()).hexdigest() == sha1:
        return dest
    temp = dest.with_suffix(".tmp")
    h = hashlib.sha1()
    with urlopen(URL + name, timeout=180) as response, open(temp, "wb") as file:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
            file.write(chunk)
    assert h.hexdigest() == sha1, name + ": checksum does not match Google's repository"
    os.replace(temp, dest)
    return dest


def extract(zip_path, names, dest):
    with ZipFile(zip_path) as z:
        for name in names:
            target = dest / name
            target.parent.mkdir(parents=True, exist_ok=True)
            with z.open(name) as src, open(target, "wb") as output:
                while True:
                    chunk = src.read(1024 * 1024)
                    if not chunk:
                        break
                    output.write(chunk)
            if name.rsplit("/", 1)[-1] in ("aapt", "aapt2", "d8", "apksigner", "zipalign"):
                target.chmod(0o755)
            print("Installed", target)


if __name__ == "__main__":
    extract(get_zip(*PKGS[0]), PLATFORM, SDK / "platforms")
    extract(get_zip(*PKGS[1]), TOOLS, SDK / "build-tools")
    print("Ready. Run ./build.sh from tools/apk/ to rebuild and re-sign the APK.")
