import os
import pandas as pd
from autogluon.multimodal import MultiModalPredictor


MODEL_PATH = "/opt/ml/model"

print(f"Loading model from {MODEL_PATH}...")

predictor = MultiModalPredictor.load(MODEL_PATH)

# Force AutoGluon to use CPU
predictor._config.env.num_gpus = 0

print("Model loaded successfully")


def predict(image_path: str):
    data = pd.DataFrame({
        "image": [image_path]
    })

    prediction = predictor.predict(data)
    probabilities = predictor.predict_proba(data)

    return {
        "prediction": str(prediction.iloc[0]),
        "probabilities": probabilities.iloc[0].to_dict()
    }