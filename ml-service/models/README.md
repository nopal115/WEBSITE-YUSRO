# ML model artifacts

The service expects an MLP checkpoint at `models/mlp.pt` by default.

The checkpoint must be a `torch.save()` dictionary, not a bare state dict. It
must include `state_dict`, `model_version` (`yusro-mlp-vMAJOR.MINOR.PATCH`),
`whisper_version`, `feature_names`, `scaler` (`mean` and positive `scale`
arrays), `hidden_layers`, output `score_0_1`, ISO-8601 `trained_at`, and
numeric `metrics` containing `mae`, `pearson_correlation`, and
`category_accuracy`. The service validates all of these before marking the
model ready.

To make an artifact auditable, it must also include `dataset_version`,
`split_seed`, `training_config`, and a unique `experiment_id`. Training never
reads application object storage: it consumes an approved, separately
credentialed feature export only.

```text
Linear(8, hidden_layers...) -> Sigmoid
```

The eight features compare the reference and recording: Whisper embedding
cosine similarity, transcription similarity, duration ratio, and four acoustic
similarities. The service returns HTTP 503 until a compatible trained artifact
is available. It does not produce a fabricated score when artifacts are missing.
Training must persist dataset version, split seed, feature order, and these
metrics alongside the checkpoint; inference reads no training dataset.
