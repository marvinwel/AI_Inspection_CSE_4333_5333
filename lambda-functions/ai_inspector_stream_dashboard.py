import os
import json
import boto3
from boto3.dynamodb.types import TypeDeserializer

s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")

BUCKET_NAME = os.environ["BUCKET_NAME"]
CONNECTION_TABLE = os.environ["CONNECTION_TABLE"]
WEBSOCKET_ENDPOINT = os.environ["WEBSOCKET_ENDPOINT"]

connections = dynamodb.Table(CONNECTION_TABLE)

deserializer = TypeDeserializer()


def deserialize_image(image):
    return {
        key: deserializer.deserialize(value)
        for key, value in image.items()
    }


def lambda_handler(event, context):

    api = boto3.client(
        "apigatewaymanagementapi",
        endpoint_url=WEBSOCKET_ENDPOINT
    )

    for record in event["Records"]:

        # Only process newly inserted inspections
        if record["eventName"] != "INSERT":
            continue

        image = record["dynamodb"]["NewImage"]
        inspection = deserialize_image(image)

        image_key = inspection["imageKey"]

        # Generate temporary S3 URL
        image_url = s3.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": BUCKET_NAME,
                "Key": image_key
            },
            ExpiresIn=86400                                         #Time limit is 1 day
        )

        payload = {
            "type": "newInspection",
            "inspectionId": inspection["inspectionId"],
            "timestamp": inspection["timestamp"],
            "result": inspection["result"],
            "confidence": float(inspection["confidence"]),
            "imageUrl": image_url
        }

        data = json.dumps(payload).encode("utf-8")

        response = connections.scan(
            ProjectionExpression="connectionId"
        )


        for connection in response["Items"]:
            connection_id = connection["connectionId"]

            try:
                api.post_to_connection(
                    ConnectionId=connection_id,
                    Data=data
                )
            
            except api.exceptions.GoneException:
                connections.delete_item(
                    Key={
                        "connectionId": connection_id
                    }
                )


    return {"statusCode": 200}