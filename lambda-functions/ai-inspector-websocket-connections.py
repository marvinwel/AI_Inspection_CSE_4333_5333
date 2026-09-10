import os
import boto3

dynamodb = boto3.resource("dynamodb")

table = dynamodb.Table(
    os.environ["CONNECTION_TABLE"]
)


def lambda_handler(event, context):

    connection_id = event["requestContext"]["connectionId"]
    route_key = event["requestContext"]["routeKey"]

    print(f"Route: {route_key}")
    print(f"Connection ID: {connection_id}")

    if route_key == "$connect":

        table.put_item(
            Item={
                "connectionId": connection_id
            }
        )

        print("Connection saved")

    elif route_key == "$disconnect":

        table.delete_item(
            Key={
                "connectionId": connection_id
            }
        )

        print("Connection removed")

    elif route_key == "$default":

        print("Default WebSocket message received")

    return {
        "statusCode": 200
    }