// /api/contact is routed to the Firebase Function `sendContactEmail`.
// Gmail credentials (GMAIL_USER, GMAIL_PASS, GMAIL_TO) must be configured as Firebase environment variables.
// When running locally, this endpoint will 404 unless the Firebase emulator or deployed functions are available.
export async function sendContactEmail(payload) {
  const response = await fetch('/api/contact', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let message = 'Failed to send contact message.';
    try {
      const data = await response.json();
      if (data && data.error) {
        message = data.error;
      }
    } catch (error) {
      // ignore JSON parsing issues and use the generic message
    }
    throw new Error(message);
  }
}
