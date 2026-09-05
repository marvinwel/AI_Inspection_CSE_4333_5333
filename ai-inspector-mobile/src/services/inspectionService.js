const INSPECT_URL =
  'https://vdtbxy07nl.execute-api.us-east-1.amazonaws.com/inspect';

const FETCH_DATA_URL =
  'https://vdtbxy07nl.execute-api.us-east-1.amazonaws.com/fetch_data';

export async function submitInspection(imageUri) {
  const imageResponse = await fetch(imageUri);
  const imageBlob = await imageResponse.blob();

  const response = await fetch(INSPECT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'image/jpeg',
    },
    body: imageBlob,
  });

  if (!response.ok) {
    const errorText = await response.text();

    console.log('Backend error status:', response.status);
    console.log('Backend error body:', errorText);

    throw new Error(
      `Inspection request failed: ${response.status} - ${errorText}`
    );
  }

  const data = await response.json();

  return {
    id: data.inspectionId,
    result: data.result,
    confidence: Math.round(
      Number(data.confidence) * 100
    ),

    rawTimestamp: data.timestamp,

    date: new Date(
      data.timestamp
    ).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),

    imageKey: data.imageKey,
    imageUri,
  };
}

export async function fetchInspections() {
  const response = await fetch(FETCH_DATA_URL);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch inspection data: ${response.status}`
    );
  }

  const data = await response.json();

  return (data.items || []).map((item) => ({
    id: item.inspectionId,
    result: item.result,

    confidence: Math.round(
      Number(item.confidence) * 100
    ),

    rawTimestamp: item.timestamp,

    date: new Date(
      item.timestamp
    ).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),

    imageKey: item.imageKey,
  }));
}