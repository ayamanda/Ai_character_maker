// scripts/make-admin.js
// Run this script to make a user an admin
// Usage: node scripts/make-admin.js <user-email>

// Load environment variables
require('dotenv').config();

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

async function makeAdmin(email) {
  try {
    // Get user by email
    const user = await admin.auth().getUserByEmail(email);
    
    // Set custom claims
    await admin.auth().setCustomUserClaims(user.uid, {
      admin: true,
      adminLevel: 'super',
      blocked: false,
    });
    
    console.log(`Successfully made ${email} a super admin!`);
    console.log(`User ID: ${user.uid}`);
    
    // The user will need to sign out and sign back in for claims to take effect
    console.log('Note: User needs to sign out and sign back in for changes to take effect.');
    
  } catch (error) {
    console.error('Error making user admin:', error);
  }
}

const email = process.argv[2];
if (!email) {
  console.log('Usage: node scripts/make-admin.js <user-email>');
  process.exit(1);
}

makeAdmin(email);