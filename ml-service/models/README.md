# ML model artifacts

The service expects an MLP checkpoint at `models/mlp.pt` by default.

The checkpoint must be a `torch.save()` dictionary, not a bare state dict. It
must include `state_dict`, `model_version`, `whisper_version`, `feature_names`,
`scaler` (`mean` and positive `scale` arrays), `hidden_layers`, and output
`score_0_1`. The service validates all of these before marking the model ready.

```text
Linear(8, hidden_layers...) -> Sigmoid
```

The eight features compare the reference and recording: Whisper embedding
cosine similarity, transcription similarity, duration ratio, and four acoustic
similarities. The service returns HTTP 503 until a compatible trained artifact
is available. It does not produce a fabricated score when artifacts are missing.
