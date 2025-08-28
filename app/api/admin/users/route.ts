import { NextRequest, NextResponse } from 'next/server';
import { UserRecord } from 'firebase-admin/auth';

export async function GET(request: NextRequest) {
    try {
        console.log('Attempting to fetch users from Firebase Auth...');
        
        // Check if we have the necessary environment variables
        if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
            throw new Error('Firebase project ID not configured');
        }
        
        // Try to import and use Firebase Admin
        let adminAuth;
        try {
            const { adminAuth: auth, isAdminSDKAvailable, getInitializationError } = await import('@/lib/firebase-admin');
            
            if (!isAdminSDKAvailable()) {
                const initError = getInitializationError();
                throw new Error(`Firebase Admin SDK not available: ${initError}`);
            }
            
            adminAuth = auth;
        } catch (importError) {
            console.error('Failed to import Firebase Admin:', importError);
            throw new Error('Firebase Admin SDK not properly configured. Service account key required.');
        }
        
        // Get all users from Firebase Auth
        const listUsersResult = await adminAuth.listUsers(1000); // Limit to 1000 users per request
        
        console.log(`Found ${listUsersResult.users.length} users in Firebase Auth`);
        
        // Transform Firebase Auth users to our format
        const users = listUsersResult.users.map((userRecord: UserRecord) => ({
            uid: userRecord.uid,
            email: userRecord.email || '',
            displayName: userRecord.displayName || userRecord.email?.split('@')[0] || 'Unknown User',
            emailVerified: userRecord.emailVerified,
            disabled: userRecord.disabled,
            photoURL: userRecord.photoURL || null,
            metadata: {
                creationTime: userRecord.metadata.creationTime,
                lastSignInTime: userRecord.metadata.lastSignInTime,
                lastRefreshTime: userRecord.metadata.lastRefreshTime,
            },
            customClaims: userRecord.customClaims || {},
            providerData: userRecord.providerData,
        }));

        return NextResponse.json({
            users,
            totalUsers: listUsersResult.users.length,
            pageToken: listUsersResult.pageToken,
            success: true
        });
    } catch (error) {
        console.error('Error fetching users from Firebase Auth:', error);
        
        // Return more specific error information
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorCode = (error as any)?.code || 'unknown';
        
        console.error('Firebase Auth API Error Details:', {
            message: errorMessage,
            code: errorCode,
            stack: error instanceof Error ? error.stack : undefined
        });
        
        return NextResponse.json(
            {
                error: 'Failed to fetch users from Firebase Auth',
                details: errorMessage,
                code: errorCode,
                success: false,
                suggestion: 'Please check Firebase Admin SDK configuration and service account credentials'
            },
            { status: 500 }
        );
    }
}