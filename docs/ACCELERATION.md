# Acceleration Strategy

DeepFaceCam uses ONNX Runtime execution providers for inference acceleration.
The backend detects available providers at startup and chooses the first
available provider in this order:

```text
CUDA > ROCm > CoreML > DirectML > CPU
```

## macOS

macOS is distributed as separate architecture builds:

- Apple Silicon: `macos-15` arm64 runner, CoreML provider preferred.
- Intel: `macos-15-intel` x64 runner, CPU provider by default.

Apple Silicon does not use PyTorch MPS. The packaged backend uses ONNX
Runtime's CoreML provider. CoreML may use CPU, GPU, and Neural Engine depending
on the model partition and macOS runtime. The app also writes generated
`*_coreml.onnx` cache files into the user model directory; those cache files
are not bundled or committed.

## Windows

Windows packaging should remain split by runtime:

- CPU: maximum compatibility, lowest speed.
- DirectML: broad Windows GPU support across NVIDIA, AMD, and Intel.
- NVIDIA CUDA: best NVIDIA performance, but sensitive to driver, CUDA, and
  cuDNN compatibility.

The GitHub-hosted Windows runner can verify packaging, but it cannot validate
CUDA performance because it does not provide a physical NVIDIA GPU. CUDA builds
need self-hosted Windows test machines for RTX 40-series and RTX 50-series.

## Fallback

Current backend behavior selects the best provider available at startup. A full
production fallback should also retry with the next provider if model session
creation fails at runtime, then surface the selected provider and fallback
reason in the UI.
