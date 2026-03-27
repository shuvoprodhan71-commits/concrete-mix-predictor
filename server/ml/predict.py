#!/usr/bin/env python3
"""
Concrete Mix Design Predictor — ML Inference Script
Called by Node.js via child_process.spawn.
Input:  JSON on stdin  { "strength": float, "age": int }
Output: JSON on stdout { ... }

Large models are downloaded from CDN on first use and cached locally.
"""
import sys, json, os, urllib.request
import numpy as np
import pandas as pd
import joblib
from scipy.spatial.distance import cdist

BASE = os.path.dirname(os.path.abspath(__file__))

# CDN URLs for large model files
CDN_MODELS = {
    "inv_models.pkl":    "https://d2xsxph8kpxj0f.cloudfront.net/310519663238122760/5fT7FdjB4vuxLhpiuBM4fa/inv_models_009d7a94.pkl",
    "forward_model.pkl": "https://d2xsxph8kpxj0f.cloudfront.net/310519663238122760/5fT7FdjB4vuxLhpiuBM4fa/forward_model_5762afc0.pkl",
}

def ensure_model(filename):
    """Download model from CDN if not present locally."""
    local_path = os.path.join(BASE, filename)
    if not os.path.exists(local_path):
        url = CDN_MODELS[filename]
        sys.stderr.write(f"[ML] Downloading {filename} from CDN...\n")
        urllib.request.urlretrieve(url, local_path)
        sys.stderr.write(f"[ML] Downloaded {filename}\n")
    return local_path

def load_models():
    ensure_model("inv_models.pkl")
    ensure_model("forward_model.pkl")

    meta        = joblib.load(os.path.join(BASE, "meta.pkl"))
    fwd_model   = joblib.load(ensure_model("forward_model.pkl"))
    scaler_fwd  = joblib.load(os.path.join(BASE, "scaler_fwd.pkl"))
    inv_models  = joblib.load(ensure_model("inv_models.pkl"))
    inv_scalers = joblib.load(os.path.join(BASE, "inv_scalers.pkl"))
    dataset     = pd.read_csv(os.path.join(BASE, "dataset.csv"))
    return meta, fwd_model, scaler_fwd, inv_models, inv_scalers, dataset

def predict_mix(target_strength, age, meta, fwd_model, scaler_fwd, inv_models, inv_scalers, dataset, k=15):
    MIX_COLS     = meta["mix_cols"]
    STRENGTH_COL = meta["strength_col"]
    AGE_COL      = meta["age_col"]

    ds_X = dataset[[STRENGTH_COL, AGE_COL]].values
    ranges = np.array([
        meta["strength_max"] - meta["strength_min"],
        max(meta["age_options"]) - min(meta["age_options"]) + 1
    ])
    ds_X_norm  = ds_X / ranges
    query_norm = np.array([[target_strength, age]]) / ranges
    dists = cdist(query_norm, ds_X_norm, metric="euclidean")[0]
    k_idx = np.argsort(dists)[:k]
    weights = 1.0 / (dists[k_idx] + 1e-9)
    weights /= weights.sum()

    knn_pred = {col: float(np.dot(weights, dataset[col].values[k_idx])) for col in MIX_COLS}
    inv_pred = {col: float(inv_models[col].predict(inv_scalers[col].transform([[target_strength, age]]))[0]) for col in MIX_COLS}
    blended  = {col: 0.6 * knn_pred[col] + 0.4 * inv_pred[col] for col in MIX_COLS}

    mix_arr  = np.array([[blended[c] for c in MIX_COLS] + [age]])
    verified = float(fwd_model.predict(scaler_fwd.transform(mix_arr))[0])

    return blended, verified

def get_ranges(meta, dataset):
    MIX_COLS = meta["mix_cols"]
    ranges = {}
    for col in MIX_COLS:
        ranges[col] = {
            "min": float(dataset[col].min()),
            "max": float(dataset[col].max())
        }
    return ranges

def main():
    raw = sys.stdin.read().strip()
    inp = json.loads(raw)
    target_strength = float(inp["strength"])
    age = int(inp["age"])

    meta, fwd_model, scaler_fwd, inv_models, inv_scalers, dataset = load_models()
    blended, verified = predict_mix(target_strength, age, meta, fwd_model, scaler_fwd, inv_models, inv_scalers, dataset)
    col_ranges = get_ranges(meta, dataset)

    error    = abs(verified - target_strength)
    errorPct = round(error / target_strength * 100, 2) if target_strength > 0 else 0.0

    components = []
    for col in meta["mix_cols"]:
        val = round(blended[col], 2)
        r   = col_ranges[col]
        ok  = r["min"] <= val <= r["max"]
        components.append({
            "name":   col,
            "value":  val,
            "min":    round(r["min"], 2),
            "max":    round(r["max"], 2),
            "status": "OK" if ok else "Warning"
        })

    result = {
        "components": components,
        "verified":   round(verified, 2),
        "target":     target_strength,
        "error":      round(error, 2),
        "errorPct":   errorPct,
        "meta": {
            "strengthMin": meta["strength_min"],
            "strengthMax": meta["strength_max"],
            "ageOptions":  meta["age_options"],
            "dataset":     "UCI Concrete (Yeh, 1998) — 1,030 samples",
            "algorithm":   "kNN 60% + Inverse RF 40%"
        }
    }
    print(json.dumps(result))

if __name__ == "__main__":
    main()
