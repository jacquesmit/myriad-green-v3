Current status: Booking PDF v1 is live (white background, dark footer). SMS/WhatsApp not yet implemented.

# Notifications & Follow-Up – Phase 2

## 1. Twilio / Messaging
- [ ] Choose final SMS/WhatsApp provider (Twilio or local ZA provider)
- [ ] Get a production number and verify business profile
- [ ] Store secrets in Firebase Secret Manager:
      TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM, TWILIO_WHATSAPP_FROM
- [ ] Wire notification helper to:
      - Booking confirmations
      - Day-before reminders
      - Missed-payment / abandoned checkout nudges

## 2. Email Follow-Up Engine
- [ ] Add scheduled follow-up emails based on booking status (new, confirmed, completed)
- [ ] Templates for:
      - Booking reminder
      - “How did we do?” review request
      - Quote follow-up

## 3. PDF Enhancements
- [ ] Dark-mode PDF variant
- [ ] Multi-page quote / invoice layout
- [ ] Signature block for client + technician
- [ ] Separate "Quote" and "Invoice" branded templates
