import websocket
import json

url = "wss://s5p3td5072.execute-api.us-east-1.amazonaws.com/production/"

print("Connecting...")

ws = websocket.create_connection(url)

print("Connected!")
print("Waiting for WebSocket messages...")

try:
    while True:
        message = ws.recv()

        if not message:
            break

        try:
            data = json.loads(message)
            print("\nReceived:")
            print(json.dumps(data, indent=2))
        except json.JSONDecodeError:
            print("\nReceived:", message)

except KeyboardInterrupt:
    print("\nDisconnecting...")

finally:
    ws.close()
