import json
import boto3
import base64
import uuid
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal


# --------------------------------------------------
# AWS clients/resources
# --------------------------------------------------

s3 = boto3.client("s3")
sns = boto3.client("sns")
dynamodb = boto3.resource("dynamodb")

table = dynamodb.Table("ai-inspector-inspections")


# --------------------------------------------------
# Configuration
# --------------------------------------------------

# CHANGE THIS to EC2 public IP.
MODEL_ENDPOINT = "http://54.221.75.52:8080/invocations"

BUCKET_NAME = "ai-inspector-images-797260139360-us-east-1"

SNS_TOPIC_ARN = (
    "arn:aws:sns:us-east-1:797260139360:"
    "ai-inspector-damage-alerts"
)




# --------------------------------------------------
# Lambda
# --------------------------------------------------

def lambda_handler(event, context):

    try:

        # ==========================================
        # 1. Get image from API Gateway
        # ==========================================

        body = event.get("body")

        if not body:
            return response(400, {
                "message": "Image body is required"
            })

        # API Gateway normally base64 encodes
        # binary image data.
        if event.get("isBase64Encoded", False):
            image_bytes = base64.b64decode(body)
        else:
            image_bytes = body.encode("latin1")


        # ==========================================
        # 2. Generate inspection ID
        # ==========================================

        inspection_id = str(uuid.uuid4())

        timestamp = datetime.now(
            timezone.utc
        ).isoformat()

        image_key = (
            f"inspections/{inspection_id}.jpg"
        )


        # ==========================================
        # 3. Upload image to S3
        # ==========================================

        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=image_key,
            Body=image_bytes,
            ContentType="image/jpeg"
        )

        print(
            f"Image uploaded to S3: {image_key}"
        )


        # ==========================================
        # 4. Send image to AI model on EC2
        # ==========================================

        request = urllib.request.Request(
            MODEL_ENDPOINT,
            data=image_bytes,
            headers={
                "Content-Type": "image/jpeg"
            },
            method="POST"
        )

        with urllib.request.urlopen(
            request,
            timeout=30
        ) as model_response:

            model_data = json.loads(
                model_response.read().decode("utf-8")
            )


        print(
            f"Model response: {model_data}"
        )


        # ==========================================
        # 5. Get prediction
        # ==========================================

        prediction = model_data["prediction"]

        probabilities = model_data.get(
            "probabilities",
            {}
        )

        confidence = probabilities.get(
            prediction,
            0
        )


        # ==========================================
        # 6. Store result in DynamoDB
        # ==========================================

        item = {
            "inspectionId": inspection_id,
            "timestamp": timestamp,
            "result": prediction,
            "confidence": Decimal(
                str(confidence)
            ),
            "imageKey": image_key
        }

        table.put_item(
            Item=item
        )

        print(
            f"Inspection saved: {inspection_id}"
        )


        # ==========================================
        # 7. Send SNS alert if damaged
        # ==========================================

        if prediction.lower() == "damaged":

            sns.publish(
                TopicArn=SNS_TOPIC_ARN,

                Subject="AI Inspector - Damage Detected",

                Message=(
                    "Damaged item detected.\n\n"
                    f"Inspection ID: {inspection_id}\n"
                    f"Result: {prediction}\n"
                    f"Confidence: {confidence:.2%}\n"
                    f"Image: s3://{BUCKET_NAME}/{image_key}\n"
                    f"Timestamp: {timestamp}"
                )
            )

            print(
                "Damage notification sent through SNS"
            )


        # ==========================================
        # 8. Return result to application
        # ==========================================

        return response(200, {
            "inspectionId": inspection_id,
            "timestamp": timestamp,
            "result": prediction,
            "confidence": float(confidence),
            "imageKey": image_key
        })


    except Exception as e:

        print(f"ERROR: {str(e)}")

        return response(500, {
            "message": "Inspection failed",
            "error": str(e)
        })


# --------------------------------------------------
# API response helper
# --------------------------------------------------

def response(status_code, body):

    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps(body)
    }