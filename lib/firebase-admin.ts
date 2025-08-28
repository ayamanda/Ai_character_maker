import { initializeApp, getApps, cert, ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let app: any = null;
let adminAuth: any = null;
let adminDb: any = null;
let initializationError: string | null = null;

try {
  // Check if app is already initialized
  if (getApps().length === 0) {
    // Try to initialize with service account if available
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY) as ServiceAccount;
        app = initializeApp({
          credential: cert(serviceAccount),
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
        console.log('Firebase Admin initialized with service account JSON');
      } catch (error) {
        console.error('Error parsing service account key:', error);
        initializationError = 'Invalid service account key format';
        throw error;
      }
    } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      // Initialize with individual environment variables
      try {
        const serviceAccount: ServiceAccount = {
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        };
        app = initializeApp({
          credential: cert(serviceAccount),
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
        console.log('Firebase Admin initialized with individual environment variables');
      } catch (error) {
        console.error('Error initializing with individual env vars:', error);
        initializationError = 'Invalid service account configuration';
        throw error;
      }
    } else {
      // Don't try default credentials in development - they usually fail
      if (process.env.NODE_ENV === 'development') {
        console.warn('Firebase Admin SDK not configured for development. Service account key required.');
        initializationError = 'Service account key required for development';
        throw new Error('Firebase Admin SDK requires service account key in development');
      } else {
        // Only try default credentials in production
        app = initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
        console.log('Firebase Admin initialized with default credentials');
      }
    }
  } else {
    app = getApps()[0];
  }

  if (app) {
    adminAuth = getAuth(app);
    adminDb = getFirestore(app);
  }
} catch (error) {
  console.error('Failed to initialize Firebase Admin:', error);
  initializationError = error instanceof Error ? error.message : 'Unknown initialization error';
}

// Export functions that handle the case where admin SDK is not available
export { adminAuth, adminDb };

export function isAdminSDKAvailable(): boolean {
  return adminAuth !== null && adminDb !== null;
}

export function getInitializationError(): string | null {
  return initializationError;
}

export default app;