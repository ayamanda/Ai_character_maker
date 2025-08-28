# Firebase Admin SDK Setup

To enable fetching users from Firebase Auth, you need to configure the Firebase Admin SDK.

## Option 1: Service Account Key (Recommended for Development)

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Add the entire JSON content as an environment variable:

```bash
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"your-project-id",...}'
```

## Option 2: Default Credentials (For Production)

If deploying to Firebase Hosting, Google Cloud Run, or similar, the default credentials will be used automatically.

## Environment Variables Required

```bash
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...} # Optional, for local development
```

## Current Fallback Behavior

If Firebase Admin SDK is not configured, the system will:
1. Use existing admin user records from Firestore
2. Scan for users in the `users` collection
3. Create admin records for users who have characters or chat sessions
4. Allow manual creation of sample users for testing

## Testing

You can test the Firebase Auth integration by:
1. Going to Admin → Users
2. Clicking "Sync Users from Firebase Auth"
3. Check the browser console for detailed logs