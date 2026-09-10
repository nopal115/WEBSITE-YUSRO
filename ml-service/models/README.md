# ML model artifacts

The service expects an MLP checkpoint at `models/mlp.pt` by default.

The checkpoint must contain the state dict for the network:

```text
Linear(390, 128) -> ReLU -> Linear(128, 1) -> Sigmoid
```

The input is the 384-dimensional Whisper Tiny encoder embedding followed by
six normalized audio features. The service returns HTTP 503 until both the
Whisper Tiny model and this trained checkpoint are available. It does not
produce a fabricated score when model artifacts are missing.