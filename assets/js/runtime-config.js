export const runtimeConfig = Object.freeze({
  apiBaseUrl: "https://africa-south1-myriad-green-v3.cloudfunctions.net",
  endpoints: {
    contact: "sendContactEmail",
    booking: "createBooking",
    quote: "sendQuote",
    verifyCheckout: "verifyCheckoutSession"
  },
  features: {
    bookingModal: true,
    paymentsEnabled: false,
    generatedPagesIndexable: false
  }
});

export function getApiUrl(key) {
  const endpoint = runtimeConfig.endpoints[key];

  if (!endpoint) {
    throw new Error(`Unknown API endpoint key: ${key}`);
  }

  return `${runtimeConfig.apiBaseUrl}/${endpoint}`;
}