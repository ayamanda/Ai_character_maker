// scripts/manage-admin.js
// Enhanced script to manage admin users
// Usage: 
//   node scripts/manage-admin.js add user@example.com super
//   node scripts/manage-admin.js add user@example.com moderator
//   node scripts/manage-admin.js add user@example.com support
//   node scripts/manage-admin.js remove user@example.com
//   node scripts/manage-admin.js block user@example.com "reason for blocking"
//   node scripts/manage-admin.js unblock user@example.com

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

async function addAdmin(email, level = 'support') {
  try {
    const user = await admin.auth().getUserByEmail(email);
    
    await admin.auth().setCustomUserClaims(user.uid, {
      admin: true,
      adminLevel: level,
      blocked: false,
    });
    
    console.log(`✅ Successfully made ${email} a ${level} admin!`);
    console.log(`User ID: ${user.uid}`);
    
  } catch (error) {
    console.error('❌ Error making user admin:', error.message);
  }
}

async function removeAdmin(email) {
  try {
    const user = await admin.auth().getUserByEmail(email);
    
    await admin.auth().setCustomUserClaims(user.uid, {
      admin: false,
      adminLevel: null,
      blocked: false,
    });
    
    console.log(`✅ Successfully removed admin privileges from ${email}`);
    
  } catch (error) {
    console.error('❌ Error removing admin:', error.message);
  }
}

async function blockUser(email, reason) {
  try {
    const user = await admin.auth().getUserByEmail(email);
    const currentClaims = (await admin.auth().getUser(user.uid)).customClaims || {};
    
    await admin.auth().setCustomUserClaims(user.uid, {
      ...currentClaims,
      blocked: true,
      blockReason: reason,
      blockExpiry: null, // Permanent block, set timestamp for temporary
    });
    
    console.log(`✅ Successfully blocked ${email}`);
    console.log(`Reason: ${reason}`);
    
  } catch (error) {
    console.error('❌ Error blocking user:', error.message);
  }
}

async function unblockUser(email) {
  try {
    const user = await admin.auth().getUserByEmail(email);
    const currentClaims = (await admin.auth().getUser(user.uid)).customClaims || {};
    
    await admin.auth().setCustomUserClaims(user.uid, {
      ...currentClaims,
      blocked: false,
      blockReason: null,
      blockExpiry: null,
    });
    
    console.log(`✅ Successfully unblocked ${email}`);
    
  } catch (error) {
    console.error('❌ Error unblocking user:', error.message);
  }
}

async function getUserInfo(email) {
  try {
    const user = await admin.auth().getUserByEmail(email);
    const userRecord = await admin.auth().getUser(user.uid);
    const claims = userRecord.customClaims || {};
    
    console.log(`\n📋 User Info for ${email}:`);
    console.log(`User ID: ${user.uid}`);
    console.log(`Admin: ${claims.admin || false}`);
    console.log(`Admin Level: ${claims.adminLevel || 'none'}`);
    console.log(`Blocked: ${claims.blocked || false}`);
    if (claims.blockReason) console.log(`Block Reason: ${claims.blockReason}`);
    
  } catch (error) {
    console.error('❌ Error getting user info:', error.message);
  }
}

// Parse command line arguments
const [action, email, levelOrReason] = process.argv.slice(2);

if (!action || !email) {
  console.log(`
🔧 Admin Management Tool

Usage:
  node scripts/manage-admin.js add <email> [level]     - Make user admin (level: super/moderator/support)
  node scripts/manage-admin.js remove <email>         - Remove admin privileges
  node scripts/manage-admin.js block <email> <reason> - Block user
  node scripts/manage-admin.js unblock <email>        - Unblock user
  node scripts/manage-admin.js info <email>           - Get user info

Examples:
  node scripts/manage-admin.js add john@example.com super
  node scripts/manage-admin.js add jane@example.com moderator
  node scripts/manage-admin.js remove john@example.com
  node scripts/manage-admin.js block spam@example.com "Spam content"
  node scripts/manage-admin.js info john@example.com
  `);
  process.exit(1);
}

// Execute the requested action
switch (action.toLowerCase()) {
  case 'add':
    const level = levelOrReason || 'support';
    if (!['super', 'moderator', 'support'].includes(level)) {
      console.error('❌ Invalid admin level. Use: super, moderator, or support');
      process.exit(1);
    }
    addAdmin(email, level);
    break;
    
  case 'remove':
    removeAdmin(email);
    break;
    
  case 'block':
    if (!levelOrReason) {
      console.error('❌ Please provide a reason for blocking');
      process.exit(1);
    }
    blockUser(email, levelOrReason);
    break;
    
  case 'unblock':
    unblockUser(email);
    break;
    
  case 'info':
    getUserInfo(email);
    break;
    
  default:
    console.error('❌ Invalid action. Use: add, remove, block, unblock, or info');
    process.exit(1);
}