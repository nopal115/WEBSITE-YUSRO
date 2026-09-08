from fastapi import FastAPI

app = FastAPI(title="Yusro ML Service")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
