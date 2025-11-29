// Calls the deployed Firebase HTTPS function to deliver contact form submissions.
const endpoint = "https://africa-south1-myriad-green-v3.cloudfunctions.net/sendContactEmail";

export async function sendContactEmail(payload) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Contact email failed (${response.status}): ${text || 'No response body'}`);
  }

  return true;
}
