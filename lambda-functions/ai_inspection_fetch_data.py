import json
import boto3
from decimal import Decimal

dynamodb = boto3.resource("dynamodb")
s3 = boto3.client("s3")

table = dynamodb.Table("ai-inspector-inspections")

BUCKET_NAME = "ai-inspector-images-797260139360-us-east-1"


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)

        return super().default(obj)


CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,OPTIONS"
}


def lambda_handler(event, context):
    try:
        # Handle browser CORS preflight request
        http_method = (
            event.get("requestContext", {})
                 .get("http", {})
                 .get("method")
        )

        # Also support REST API Gateway event format
        if not http_method:
            http_method = event.get("httpMethod")

        if http_method == "OPTIONS":
            return {
                "statusCode": 200,
                "headers": CORS_HEADERS,
                "body": ""
            }

        items = []

        # Scan DynamoDB table
        response = table.scan()
        items.extend(response.get("Items", []))

        # Continue scanning if DynamoDB returns more pages
        while "LastEvaluatedKey" in response:
            response = table.scan(
                ExclusiveStartKey=response["LastEvaluatedKey"]
            )

            items.extend(response.get("Items", []))

        # Generate a fresh presigned URL for every image
        for item in items:
            image_key = item.get("imageKey")

            if image_key:
                try:
                    image_url = s3.generate_presigned_url(
                        "get_object",
                        Params={
                            "Bucket": BUCKET_NAME,
                            "Key": image_key
                        },
                        ExpiresIn=86400
                    )

                    item["imageUrl"] = image_url

                except Exception as e:
                    print(
                        f"Failed to generate URL for "
                        f"{image_key}: {str(e)}"
                    )

                    item["imageUrl"] = None

            else:
                item["imageUrl"] = None

        # Newest inspections first
        items.sort(
            key=lambda x: x.get("timestamp", ""),
            reverse=True
        )

        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": json.dumps(
                {
                    "count": len(items),
                    "items": items
                },
                cls=DecimalEncoder
            )
        }

    except Exception as e:
        print(f"Error: {str(e)}")

        return {
            "statusCode": 500,
            "headers": CORS_HEADERS,
            "body": json.dumps(
                {
                    "message": "Failed to retrieve inspections",
                    "error": str(e)
                }
            )
        }