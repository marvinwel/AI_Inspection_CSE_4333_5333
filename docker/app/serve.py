import os
import tempfile

from flask import Flask, request, jsonify
from inference import predict

app = Flask(__name__)


@app.route("/ping", methods=["GET"])
def ping():
    return "", 200


@app.route("/invocations", methods=["POST"])
def invocations():
    image_bytes = request.get_data()

    if not image_bytes:
        return jsonify({"error": "No image provided"}), 400

    image_path = None

    try:
        with tempfile.NamedTemporaryFile(
            suffix=".jpg",
            delete=False
        ) as f:
            f.write(image_bytes)
            image_path = f.name

        result = predict(image_path)

        return jsonify(result), 200

    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500

    finally:
        if image_path and os.path.exists(image_path):
            os.remove(image_path)


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=8080
    )