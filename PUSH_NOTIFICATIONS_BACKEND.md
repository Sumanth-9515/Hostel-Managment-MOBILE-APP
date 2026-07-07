# Push Notifications — Implementation & Setup

Real-time push (WhatsApp-style) is now wired end-to-end. When a tenant submits
the onboarding form, the owner who owns that link gets a push notification on
every device they are logged in on — **even if the app is closed**.

## How it works

1. **Login (app):** after login the app asks for notification permission, gets
   its FCM device token and registers it:
   `POST /api/push-tokens/register` → stored on the owner's `User.fcmTokens`.
2. **Onboarding submit (backend):** `POST /api/tenants/register-via-link` saves
   the tenant, then sends an FCM notification to all of that owner's tokens.
3. **Delivery:** a `notification` payload is sent, so Android/iOS display it in
   the system tray when the app is backgrounded or killed. In the foreground the
   app shows an in-app alert and the existing onboarding banner.
4. **Logout (app):** `POST /api/push-tokens/unregister` removes the device token
   so a signed-out phone stops receiving that owner's pushes.

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/push-tokens/register` | owner JWT | Save/refresh this device's FCM token |
| POST | `/api/push-tokens/unregister` | owner JWT | Remove this device's token on logout |

Register body:
```json
{ "token": "<fcm-device-token>", "platform": "android", "ownerId": "<owner-id>" }
```

## FCM payload sent on onboarding submit

```json
{
  "tokens": ["<owner device tokens>"],
  "notification": {
    "title": "New Onboarding Submission 📥",
    "body": "Hi <owner>, <tenant> just submitted the onboarding form (Building • Room) at <time>. Tap to review."
  },
  "data": { "type": "onboarding-submission", "tenantId": "<id>", "ownerId": "<id>" },
  "android": { "priority": "high", "notification": { "channelId": "onboarding", "sound": "default" } },
  "apns": { "headers": { "apns-priority": "10" }, "payload": { "aps": { "sound": "default" } } }
}
```

---

## ⚙️ Required setup (one-time)

### 1. Firebase project
Create a Firebase project (or reuse the one for the Android app) and enable
**Cloud Messaging**.

### 2. Android app — `google-services.json`
Download `google-services.json` for the Android app
(package `com.hostelappmanagementsystem`) and place it at:
```
android/app/google-services.json
```
Then rebuild the app (`npx react-native run-android`). Without this file FCM
tokens cannot be obtained on the device.

### 3. Backend — service account credentials
In **Firebase Console → Project settings → Service accounts → Generate new
private key**. Then provide it to the backend in **one** of these ways:

**Option A — single env var (recommended for Render/hosting):**
```
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...", ... }
```
(paste the entire JSON on one line)

**Option B — split env vars:**
```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```
(keep the literal `\n` escapes; the backend converts them to newlines)

**Option C — local file (dev only):**
Save the JSON as `backend/serviceAccountKey.json` (already git-ignore it).

### 4. Install the backend dependency
```
cd backend
npm install        # installs firebase-admin
```

If none of the credentials above are configured the server still boots — push is
simply disabled with a warning in the logs, so nothing else breaks.
