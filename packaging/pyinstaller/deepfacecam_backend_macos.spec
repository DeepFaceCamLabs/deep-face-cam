# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path

project_root = Path(SPECPATH).parents[1]
backend_root = project_root / "backend"
shims_root = project_root / "packaging" / "pyinstaller" / "shims"
runtime_bin = project_root / "packaging" / "pyinstaller" / "runtime" / "macos" / "bin"

datas = [
    (str(project_root / "models" / "manifest.json"), "models"),
    (str(backend_root / "locales"), "locales"),
]
if runtime_bin.exists():
    datas.append((str(runtime_bin), "bin"))

hiddenimports = [
    "modules.processors.frame.face_swapper",
    "modules.processors.frame.face_enhancer",
    "modules.processors.frame.face_enhancer_gpen256",
    "modules.processors.frame.face_enhancer_gpen512",
    "modules.processors.frame._onnx_enhancer",
    "insightface.app",
    "insightface.app.common",
    "insightface.model_zoo",
    "insightface.model_zoo.arcface_onnx",
    "insightface.model_zoo.inswapper",
    "insightface.model_zoo.retinaface",
    "insightface.model_zoo.landmark",
    "insightface.model_zoo.attribute",
    "skimage",
    "skimage.io",
    "skimage.transform",
    "albumentations",
    "albumentations.core",
    "albumentations.core.transforms_interface",
    "onnxruntime",
    "cv2",
    "aiohttp",
]

excludes = [
    "PySide6",
    "PyQt5",
    "PyQt6",
    "tkinter",
    "tensorflow",
    "tensorflow_datasets",
    "torch",
    "torchvision",
    "opennsfw2",
    "matplotlib",
    "scipy",
    "sklearn",
    "modules.ui",
]

a = Analysis(
    [str(project_root / "packaging" / "pyinstaller" / "deepfacecam_backend.py")],
    pathex=[str(shims_root), str(backend_root)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=excludes,
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="deepfacecam-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch="arm64",
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="deepfacecam-backend",
)
