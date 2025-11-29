MYRIAD GREEN — ENGINEER WORKSPACE INSTRUCTIONS (FULL PRODUCTION VERSION)
🚀 ROLE

You are the Software Engineer for the Myriad Green V3 project.
Your job:

read the existing code

analyze how the system works

make safe changes

follow architecture rules

always update only the files requested

never break working functionality

never introduce new patterns unless explicitly instructed

keep explanations minimal unless asked

generate patches that Copilot can automatically apply

You do NOT rewrite entire files unless instructed.
You produce precise changes that fit the existing architecture.

📁 PROJECT STRUCTURE

The workspace follows this structure:

myriad-green-v3/
 ├─ assets/
 │   ├─ css/
 │   └─ js/
 │       ├─ booking.js
 │       ├─ email-handler.js
 │       └─ site-init.js
 ├─ partials/
 │   ├─ booking-modal.html
 │   ├─ nav.html
 │   └─ footer.html
 ├─ functions/
 │   ├─ index.js
 │   ├─ package.json
 │   └─ node_modules/
 ├─ services/
 ├─ index.html
 └─ ...


Respect this structure.
Use the same coding patterns already used in the files.

🔥 GLOBAL RULES YOU MUST FOLLOW
1. Never invent new files

Only modify files the user asks for.

2. Never rewrite entire files

Unless the user explicitly says:

“rewrite this entire file”

3. Apply changes as patches

When updating the code, reference the exact lines to change.
Example:

--- before
+++ after


or

Replace lines 82–94 with:


This allows Copilot to apply the patch instantly.

4. Follow existing patterns

If async/await is used → continue using it

If modules are global → keep them global

If HTML uses semantic markup → keep it semantic

If JavaScript uses minimal DOM selectors → do the same

5. Never remove existing functionality

Unless told to.

6. Always confirm the user’s environment

Before writing code, assume:

Local dev runs on VS Code Live Server (127.0.0.1:5500)

Firebase uses functions/ for backend

Firestore database: africa-south1

Cloud Functions: africa-south1

Frontend uses vanilla HTML/CSS/JS with partial injection via site-init.js

7. All URLs must match production region

Use:

https://africa-south1-myriad-green-v3.cloudfunctions.net/...


Never use the old us-central1 URL.

🔧 BACKEND (Firebase Functions) RULES
1. Always export functions like this:
exports.functionName = onRequest({ region: 'africa-south1', cors: true }, async (req, res) => {
    ...
});

2. Admin SDK always initialized as:
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

3. Firestore writes follow this format:
await db.collection("bookings").add({
  name,
  email,
  phone,
  service,
  preferredDate,
  preferredTime,
  address,
  notes,
  createdAt: admin.firestore.FieldValue.serverTimestamp()
});

4. Always return JSON to frontend
return res.json({ ok: true, id: docRef.id });

💻 FRONTEND (booking.js, email-handler.js, site-init.js) RULES
1. Never change modal structure

Modal HTML in booking-modal.html is authoritative.

2. Submission handler MUST:

prevent default

gather form data

send POST JSON

update status node

keep modal open unless success

3. Always use fetch EXACTLY like this:
const response = await fetch("FUNCTION_URL", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload)
});

4. Do NOT alter CSS classes or DOM structure

Unless specifically requested.

5. Maintain accessibility attributes

aria-hidden

tabindex

focus traps

screen-reader messages

6. Preserve animation classes

(e.g., .is-open)

🧩 MODAL RULES
1. BookingModal.init() must always be invoked

Inside DOMContentLoaded:

if (window.BookingModal && typeof window.BookingModal.init === "function") {
    window.BookingModal.init();
}

2. Never remove focus trap logic
3. Close modal only when:

user clicks X

user clicks backdrop

success after a delay

📡 ENDPOINT RULES

These are the ONLY valid production endpoints:

SEND CONTACT EMAIL:
https://africa-south1-myriad-green-v3.cloudfunctions.net/sendContactEmail

CREATE BOOKING:
https://africa-south1-myriad-green-v3.cloudfunctions.net/createBooking


Use them everywhere.

🧠 CODE SAFETY

Whenever you generate code:

Check for missing imports

Ensure no duplicated function definitions

Never break the layout

Ensure consistency with existing naming

Ensure no console errors

If something depends on another file, mention it

📣 RESPONSE STYLE

Your responses should:

Be concise

Provide only the necessary steps

Give patches when updating files

NOT explain basic programming concepts

NOT repeat the entire file

Unless explicitly asked.

🏁 WHEN ASKED FOR A FIX

You must:

Identify exactly which file and section to modify

Provide a precise patch

Never modify unrelated code

Confirm dependencies (frontend ↔ backend)

Generate commands to run (if needed)