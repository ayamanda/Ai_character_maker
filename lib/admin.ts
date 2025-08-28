// lib/admin.ts
import { User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { CustomClaims, AdminUser, AdminCharacterView, AdminChatView } from '@/types';

/**
 * Check if a user has admin privileges
 */
export async function isUserAdmin(user: User | null): Promise<boolean> {
  if (!user) return false;
  
  try {
    // Get the user's ID token to check custom claims
    const idTokenResult = await user.getIdTokenResult();
    const claims = idTokenResult.claims as unknown as CustomClaims;
    
    return claims.admin === true && !claims.blocked;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Get admin level for a user
 */
export async function getUserAdminLevel(user: User | null): Promise<'super' | 'moderator' | 'support' | null> {
  if (!user) return null;
  
  try {
    const idTokenResult = await user.getIdTokenResult();
    const claims = idTokenResult.claims as unknown as CustomClaims;
    
    if (claims.admin && !claims.blocked) {
      return claims.adminLevel || 'support';
    }
    
    return null;
  } catch (error) {
    console.error('Error getting admin level:', error);
    return null;
  }
}

/**
 * Check if user is blocked
 */
export async function isUserBlocked(user: User | null): Promise<boolean> {
  if (!user) return false;
  
  try {
    const idTokenResult = await user.getIdTokenResult();
    const claims = idTokenResult.claims as unknown as CustomClaims;
    
    if (claims.blocked) {
      // Check if block has expired
      if (claims.blockExpiry && claims.blockExpiry < Date.now()) {
        return false;
      }
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking block status:', error);
    return false;
  }
}

/**
 * Get or create admin user document
 */
export async function getAdminUser(user: User): Promise<AdminUser | null> {
  try {
    const adminUserRef = doc(db, 'adminUsers', user.uid);
    const adminUserDoc = await getDoc(adminUserRef);
    
    if (adminUserDoc.exists()) {
      const data = adminUserDoc.data();
      return {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        isAdmin: data.isAdmin || false,
        adminLevel: data.adminLevel || 'support',
        isBlocked: data.isBlocked || false,
        blockReason: data.blockReason,
        blockExpiry: data.blockExpiry?.toDate(),
        createdAt: data.createdAt?.toDate() || new Date(),
        lastLogin: data.lastLogin?.toDate() || new Date(),
        metadata: data.metadata || {
          characterCount: 0,
          messageCount: 0,
          flaggedContent: 0,
        },
      };
    }
    
    // Create new admin user document if it doesn't exist
    const newAdminUser: AdminUser = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      isAdmin: false,
      adminLevel: 'support',
      isBlocked: false,
      createdAt: new Date(),
      lastLogin: new Date(),
      metadata: {
        characterCount: 0,
        messageCount: 0,
        flaggedContent: 0,
      },
    };
    
    const adminData: any = {
      uid: newAdminUser.uid,
      email: newAdminUser.email,
      displayName: newAdminUser.displayName,
      isAdmin: newAdminUser.isAdmin,
      adminLevel: newAdminUser.adminLevel,
      isBlocked: newAdminUser.isBlocked,
      createdAt: new Date(),
      lastLogin: new Date(),
      metadata: newAdminUser.metadata,
    };
    
    // Only add optional fields if they have values
    if (newAdminUser.blockReason) {
      adminData.blockReason = newAdminUser.blockReason;
    }
    if (newAdminUser.blockExpiry) {
      adminData.blockExpiry = newAdminUser.blockExpiry;
    }
    
    await setDoc(adminUserRef, adminData);
    
    return newAdminUser;
  } catch (error) {
    console.error('Error getting admin user:', error);
    return null;
  }
}

/**
 * Update user's last login time and ensure user exists in adminUsers collection
 */
export async function updateLastLogin(userId: string, userEmail?: string, userDisplayName?: string): Promise<void> {
  try {
    const adminUserRef = doc(db, 'adminUsers', userId);
    
    // Check if user exists first
    const existingDoc = await getDoc(adminUserRef);
    
    if (!existingDoc.exists()) {
      // Create new user document with basic info
      await setDoc(adminUserRef, {
        email: userEmail || '',
        displayName: userDisplayName || userEmail?.split('@')[0] || 'Unknown User',
        isAdmin: false,
        adminLevel: 'support',
        isBlocked: false,
        createdAt: new Date(),
        lastLogin: new Date(),
        metadata: {
          characterCount: 0,
          messageCount: 0,
          flaggedContent: 0,
        },
        metadataUpdated: new Date(),
      });
      console.log(`Created new admin user document for ${userId}`);
    } else {
      // Just update last login for existing users
      await setDoc(adminUserRef, {
        lastLogin: new Date(),
      }, { merge: true });
    }
  } catch (error) {
    console.error('Error updating last login:', error);
  }
}

/**
 * Log admin action
 */
export async function logAdminAction(
  adminId: string,
  adminEmail: string,
  action: string,
  targetType: 'user' | 'character' | 'chat',
  targetId: string,
  reason: string,
  details: Record<string, any> = {}
): Promise<void> {
  try {
    const actionRef = doc(db, 'adminActions', `${Date.now()}_${adminId}`);
    await setDoc(actionRef, {
      adminId,
      adminEmail,
      action,
      targetType,
      targetId,
      reason,
      details,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error logging admin action:', error);
  }
}

// Cache for admin data to avoid repeated expensive queries
interface AdminCache {
  users: AdminUser[];
  lastFetch: number;
  ttl: number; // Time to live in milliseconds
}

const adminCache: AdminCache = {
  users: [],
  lastFetch: 0,
  ttl: 5 * 60 * 1000, // 5 minutes cache
};

/**
 * Get all users for admin management with caching - optimized to use Firestore directly
 */
export async function getAllUsers(forceRefresh = false): Promise<AdminUser[]> {
  try {
    const now = Date.now();
    
    // Return cached data if still valid and not forcing refresh
    if (!forceRefresh && adminCache.users.length > 0 && (now - adminCache.lastFetch) < adminCache.ttl) {
      console.log(`Returning ${adminCache.users.length} cached users`);
      return adminCache.users;
    }
    
    const { collection, getDocs, query, orderBy } = await import('firebase/firestore');
    
    console.log('Fetching users from Firestore adminUsers collection...');
    
    // Get existing admin users with cached metadata - this is our primary source now
    const adminUsersRef = collection(db, 'adminUsers');
    const adminQuery = query(adminUsersRef, orderBy('lastLogin', 'desc'));
    const adminSnapshot = await getDocs(adminQuery);
    
    const adminUsers: AdminUser[] = [];
    
    // Process existing admin users from Firestore
    adminSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const now = Date.now();
      
      // Check if metadata needs updating (older than 1 hour)
      const metadataAge = data.metadataUpdated?.toDate?.()?.getTime() || 0;
      const shouldUpdateMetadata = !data.metadata || (now - metadataAge) > (60 * 60 * 1000);
      
      adminUsers.push({
        uid: doc.id,
        email: data.email || '',
        displayName: data.displayName || data.email?.split('@')[0] || 'Unknown User',
        isAdmin: data.isAdmin || false,
        adminLevel: data.adminLevel || 'support',
        isBlocked: data.isBlocked || false,
        blockReason: data.blockReason,
        blockExpiry: data.blockExpiry?.toDate(),
        createdAt: data.createdAt?.toDate() || new Date(),
        lastLogin: data.lastLogin?.toDate() || new Date(),
        metadata: data.metadata || {
          characterCount: 0,
          messageCount: 0,
          flaggedContent: 0,
        },
        needsMetadataUpdate: shouldUpdateMetadata,
      });
    });
    
    // If we have very few users or it's been a while, try to sync with Firebase Auth
    // This handles new users who might not be in adminUsers collection yet
    if (adminUsers.length < 5 || forceRefresh) {
      console.log('Attempting to sync with Firebase Auth for new users...');
      
      try {
        const response = await fetch('/api/admin/users');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.users) {
            const firebaseAuthUsers = data.users;
            console.log(`Found ${firebaseAuthUsers.length} users in Firebase Auth`);
            
            // Check for new users not in our adminUsers collection
            const existingUserIds = new Set(adminUsers.map(u => u.uid));
            const newUsers = firebaseAuthUsers.filter((authUser: any) => !existingUserIds.has(authUser.uid));
            
            if (newUsers.length > 0) {
              console.log(`Found ${newUsers.length} new users to add to adminUsers collection`);
              
              // Add new users to our collection and to the result
              for (const authUser of newUsers) {
                const newAdminUser: AdminUser = {
                  uid: authUser.uid,
                  email: authUser.email || '',
                  displayName: authUser.displayName || authUser.email?.split('@')[0] || 'Unknown User',
                  isAdmin: authUser.customClaims?.admin || false,
                  adminLevel: authUser.customClaims?.adminLevel || 'support',
                  isBlocked: authUser.disabled || false,
                  createdAt: new Date(authUser.metadata.creationTime),
                  lastLogin: authUser.metadata.lastSignInTime ? new Date(authUser.metadata.lastSignInTime) : new Date(),
                  metadata: {
                    characterCount: 0,
                    messageCount: 0,
                    flaggedContent: 0,
                  },
                  needsMetadataUpdate: true,
                };
                
                // Add to Firestore
                const adminData: any = {
                  email: newAdminUser.email,
                  displayName: newAdminUser.displayName,
                  isAdmin: newAdminUser.isAdmin,
                  adminLevel: newAdminUser.adminLevel,
                  isBlocked: newAdminUser.isBlocked,
                  createdAt: newAdminUser.createdAt,
                  lastLogin: newAdminUser.lastLogin,
                  metadata: newAdminUser.metadata,
                  metadataUpdated: new Date(),
                };
                
                await setDoc(doc(db, 'adminUsers', authUser.uid), adminData, { merge: true });
                adminUsers.push(newAdminUser);
              }
            }
          }
        }
      } catch (apiError) {
        console.log('Firebase Auth API not available, using Firestore data only:', apiError);
      }
    }
    
    // Background metadata update for users that need it (don't wait for this)
    const usersNeedingUpdate = adminUsers.filter(u => u.needsMetadataUpdate);
    if (usersNeedingUpdate.length > 0) {
      console.log(`Scheduling background metadata update for ${usersNeedingUpdate.length} users`);
      
      // Update metadata in background (don't await this)
      updateUserMetadataInBackground(usersNeedingUpdate.slice(0, 10)); // Limit to 10 at a time
    }
    
    // Sort by last login (most recent first)
    adminUsers.sort((a, b) => b.lastLogin.getTime() - a.lastLogin.getTime());
    
    // Update cache
    adminCache.users = adminUsers;
    adminCache.lastFetch = now;
    
    console.log(`Returning ${adminUsers.length} users for admin management`);
    return adminUsers;
  } catch (error) {
    console.error('Error getting all users:', error);
    return adminCache.users; // Return cached data on error
  }
}

/**
 * Block a user
 */
export async function blockUser(
  userId: string,
  reason: string,
  adminId: string,
  adminEmail: string,
  duration?: number
): Promise<void> {
  try {
    const userRef = doc(db, 'adminUsers', userId);
    const updates: any = {
      isBlocked: true,
      blockReason: reason || 'No reason provided',
    };
    
    if (duration) {
      updates.blockExpiry = new Date(Date.now() + duration);
    }
    
    await updateDoc(userRef, updates);
    
    // Log the action
    await logAdminActionEnhanced(adminId, adminEmail, 'block_user', 'user', userId, reason, {
      duration: duration || 'permanent',
    }, 'high');
  } catch (error) {
    console.error('Error blocking user:', error);
    throw error;
  }
}

/**
 * Unblock a user
 */
export async function unblockUser(
  userId: string,
  reason: string,
  adminId: string,
  adminEmail: string
): Promise<void> {
  try {
    const { deleteField } = await import('firebase/firestore');
    const userRef = doc(db, 'adminUsers', userId);
    await updateDoc(userRef, {
      isBlocked: false,
      blockReason: deleteField(),
      blockExpiry: deleteField(),
    });
    
    // Log the action
    await logAdminActionEnhanced(adminId, adminEmail, 'unblock_user', 'user', userId, reason, {}, 'medium');
  } catch (error) {
    console.error('Error unblocking user:', error);
    throw error;
  }
}

/**
 * Delete a user account
 */
export async function deleteUser(
  userId: string,
  reason: string,
  adminId: string,
  adminEmail: string
): Promise<void> {
  try {
    const { deleteDoc } = await import('firebase/firestore');
    
    // Delete user document
    const userRef = doc(db, 'adminUsers', userId);
    await deleteDoc(userRef);
    
    // Log the action
    await logAdminActionEnhanced(adminId, adminEmail, 'delete_user', 'user', userId, reason, {}, 'critical');
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

/**
 * Make a user an admin
 */
export async function makeUserAdmin(
  userId: string,
  adminLevel: 'super' | 'moderator' | 'support',
  reason: string,
  adminId: string,
  adminEmail: string
): Promise<void> {
  try {
    const userRef = doc(db, 'adminUsers', userId);
    await updateDoc(userRef, {
      isAdmin: true,
      adminLevel: adminLevel,
    });
    
    // Log the action
    await logAdminActionEnhanced(adminId, adminEmail, 'make_admin', 'user', userId, reason, {
      adminLevel,
    }, 'critical');
  } catch (error) {
    console.error('Error making user admin:', error);
    throw error;
  }
}

/**
 * Remove admin privileges from a user
 */
export async function removeUserAdmin(
  userId: string,
  reason: string,
  adminId: string,
  adminEmail: string
): Promise<void> {
  try {
    const userRef = doc(db, 'adminUsers', userId);
    await updateDoc(userRef, {
      isAdmin: false,
      adminLevel: 'support',
    });
    
    // Log the action
    await logAdminActionEnhanced(adminId, adminEmail, 'remove_admin', 'user', userId, reason, {}, 'high');
  } catch (error) {
    console.error('Error removing admin privileges:', error);
    throw error;
  }
}

/**
 * Get user characters for admin view
 */
export async function getUserCharacters(userId: string): Promise<AdminCharacterView[]> {
  try {
    const { collection, getDocs } = await import('firebase/firestore');
    const charactersRef = collection(db, `users/${userId}/characters`);
    const snapshot = await getDocs(charactersRef);
    
    // Get user info for the characters
    const userRef = doc(db, 'adminUsers', userId);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || '',
        age: data.age || 0,
        profession: data.profession || '',
        tone: data.tone || '',
        description: data.description || '',
        createdAt: data.createdAt,
        lastUsed: data.lastUsed?.toDate() || new Date(),
        userId: userId,
        userName: userData?.displayName || '',
        userEmail: userData?.email || '',
        messageCount: data.messageCount || 0,
        isFlagged: data.isFlagged || false,
        flagReason: data.flagReason,
        reportCount: data.reportCount || 0,
      };
    });
  } catch (error) {
    console.error('Error getting user characters:', error);
    return [];
  }
}

/**
 * Get user chat sessions for admin view
 */
export async function getUserChatSessions(userId: string): Promise<AdminChatView[]> {
  try {
    const { collection, getDocs } = await import('firebase/firestore');
    
    // Get user info for the chats
    const userRef = doc(db, 'adminUsers', userId);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();
    
    const chatSessions: AdminChatView[] = [];
    
    // Get new structure chat sessions
    try {
      const chatsRef = collection(db, `users/${userId}/chatSessions`);
      const snapshot = await getDocs(chatsRef);
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        chatSessions.push({
          id: doc.id,
          name: data.name || '',
          characterId: data.characterId || '',
          characterData: data.characterData || {},
          lastMessage: data.lastMessage || '',
          lastMessageTime: data.lastMessageTime,
          createdAt: data.createdAt,
          messageCount: data.messageCount || 0,
          userId: userId,
          userName: userData?.displayName || '',
          userEmail: userData?.email || '',
          isFlagged: data.isFlagged || false,
          flagReason: data.flagReason,
          lastActivity: data.lastMessageTime?.toDate() || new Date(),
          totalMessages: data.messageCount || 0,
        });
      });
    } catch (error) {
      console.log(`No new chat sessions found for user ${userId}`);
    }
    
    // Check for legacy messages structure
    try {
      const legacyMessagesRef = collection(db, `users/${userId}/messages`);
      const legacySnapshot = await getDocs(legacyMessagesRef);
      
      if (legacySnapshot.size > 0) {
        // Create a virtual chat session for legacy messages
        const legacyMessages = legacySnapshot.docs.map(doc => doc.data());
        const lastMessage = legacyMessages[legacyMessages.length - 1];
        
        chatSessions.push({
          id: `legacy-messages-${userId}`,
          name: 'Legacy Messages',
          characterId: 'legacy',
          characterData: { name: 'Legacy Character', age: 0, profession: '', tone: '', description: 'Legacy character from old message structure' },
          lastMessage: lastMessage?.text || 'Legacy message',
          lastMessageTime: lastMessage?.createdAt || null,
          createdAt: legacyMessages[0]?.createdAt || null,
          messageCount: legacySnapshot.size,
          userId: userId,
          userName: userData?.displayName || '',
          userEmail: userData?.email || '',
          isFlagged: false,
          flagReason: undefined,
          lastActivity: lastMessage?.createdAt?.toDate() || new Date(),
          totalMessages: legacySnapshot.size,
        });
        
        console.log(`Found ${legacySnapshot.size} legacy messages for user ${userId}`);
      }
    } catch (legacyError) {
      console.log(`No legacy messages found for user ${userId}`);
    }
    
    return chatSessions;
  } catch (error) {
    console.error('Error getting user chat sessions:', error);
    return [];
  }
}

/**
 * Update user metadata in background (non-blocking)
 */
async function updateUserMetadataInBackground(users: AdminUser[]): Promise<void> {
  // Run this in the background without blocking the main function
  setTimeout(async () => {
    const { collection, getDocs } = await import('firebase/firestore');
    
    for (const user of users) {
      try {
        console.log(`Updating metadata for user ${user.uid} in background`);
        
        let characterCount = 0;
        let messageCount = 0;
        
        // Count characters (lightweight query)
        try {
          const charactersRef = collection(db, `users/${user.uid}/characters`);
          const charactersSnapshot = await getDocs(charactersRef);
          characterCount = charactersSnapshot.size;
        } catch (error) {
          // User might not have characters collection yet
        }
        
        // Count messages from chat sessions (use cached messageCount from sessions)
        try {
          const sessionsRef = collection(db, `users/${user.uid}/chatSessions`);
          const sessionsSnapshot = await getDocs(sessionsRef);
          
          messageCount = 0;
          sessionsSnapshot.docs.forEach(sessionDoc => {
            const sessionData = sessionDoc.data();
            messageCount += sessionData.messageCount || 0;
          });
          
          // Count legacy messages only if no sessions exist
          if (sessionsSnapshot.size === 0) {
            try {
              const legacyMessagesRef = collection(db, `users/${user.uid}/messages`);
              const legacyMessagesSnapshot = await getDocs(legacyMessagesRef);
              messageCount += legacyMessagesSnapshot.size;
            } catch (legacyError) {
              // No legacy messages, which is fine
            }
          }
        } catch (error) {
          // User might not have messages yet
        }
        
        // Update cached metadata in Firestore
        const adminData: any = {
          metadata: {
            characterCount,
            messageCount,
            flaggedContent: 0, // This would need separate tracking
          },
          metadataUpdated: new Date(),
        };
        
        await setDoc(doc(db, 'adminUsers', user.uid), adminData, { merge: true });
        
        // Update in-memory cache if user is still there
        const cachedUser = adminCache.users.find(u => u.uid === user.uid);
        if (cachedUser) {
          cachedUser.metadata = adminData.metadata;
          cachedUser.needsMetadataUpdate = false;
        }
        
        console.log(`Updated metadata for user ${user.uid}: ${characterCount} characters, ${messageCount} messages`);
        
      } catch (error) {
        console.log(`Error updating metadata for user ${user.uid}:`, error);
      }
      
      // Small delay between users to avoid overwhelming Firestore
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }, 0);
}

/**
 * Clear admin caches
 */
export function clearAdminCaches(): void {
  adminCache.users = [];
  adminCache.lastFetch = 0;
  characterCache.characters = [];
  characterCache.lastFetch = 0;
  chatCache.chats = [];
  chatCache.lastFetch = 0;
  console.log('Admin caches cleared');
}

/**
 * Get cache status for debugging
 */
export function getCacheStatus() {
  const now = Date.now();
  return {
    users: {
      count: adminCache.users.length,
      lastFetch: adminCache.lastFetch,
      age: adminCache.lastFetch ? now - adminCache.lastFetch : 0,
      isValid: adminCache.users.length > 0 && (now - adminCache.lastFetch) < adminCache.ttl,
    },
    characters: {
      count: characterCache.characters.length,
      lastFetch: characterCache.lastFetch,
      age: characterCache.lastFetch ? now - characterCache.lastFetch : 0,
      isValid: characterCache.characters.length > 0 && (now - characterCache.lastFetch) < characterCache.ttl,
    },
    chats: {
      count: chatCache.chats.length,
      lastFetch: chatCache.lastFetch,
      age: chatCache.lastFetch ? now - chatCache.lastFetch : 0,
      isValid: chatCache.chats.length > 0 && (now - chatCache.lastFetch) < chatCache.ttl,
    },
  };
}

/**
 * Trigger background metadata sync
 */
export async function triggerMetadataSync(batchSize = 10, maxUsers = 50): Promise<any> {
  try {
    const response = await fetch(`/api/admin/metadata-sync?batchSize=${batchSize}&maxUsers=${maxUsers}`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('Background metadata sync result:', result);
    return result;
  } catch (error) {
    console.error('Error triggering metadata sync:', error);
    throw error;
  }
}

/**
 * Get a specific user by ID directly from Firestore (fast lookup)
 */
export async function getUserById(userId: string): Promise<AdminUser | null> {
  try {
    const adminUserRef = doc(db, 'adminUsers', userId);
    const adminUserDoc = await getDoc(adminUserRef);
    
    if (!adminUserDoc.exists()) {
      return null;
    }
    
    const data = adminUserDoc.data();
    return {
      uid: userId,
      email: data.email || '',
      displayName: data.displayName || '',
      isAdmin: data.isAdmin || false,
      adminLevel: data.adminLevel || 'support',
      isBlocked: data.isBlocked || false,
      blockReason: data.blockReason,
      blockExpiry: data.blockExpiry?.toDate(),
      createdAt: data.createdAt?.toDate() || new Date(),
      lastLogin: data.lastLogin?.toDate() || new Date(),
      metadata: data.metadata || {
        characterCount: 0,
        messageCount: 0,
        flaggedContent: 0,
      },
    };
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
  }
}

/**
 * Get multiple users by IDs directly from Firestore (batch lookup)
 */
export async function getUsersByIds(userIds: string[]): Promise<AdminUser[]> {
  try {
    const { documentId, where, query, collection, getDocs } = await import('firebase/firestore');
    
    if (userIds.length === 0) return [];
    
    // Firestore 'in' queries are limited to 10 items, so batch them
    const batches: string[][] = [];
    for (let i = 0; i < userIds.length; i += 10) {
      batches.push(userIds.slice(i, i + 10));
    }
    
    const allUsers: AdminUser[] = [];
    
    for (const batch of batches) {
      const adminUsersRef = collection(db, 'adminUsers');
      const batchQuery = query(adminUsersRef, where(documentId(), 'in', batch));
      const snapshot = await getDocs(batchQuery);
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        allUsers.push({
          uid: doc.id,
          email: data.email || '',
          displayName: data.displayName || '',
          isAdmin: data.isAdmin || false,
          adminLevel: data.adminLevel || 'support',
          isBlocked: data.isBlocked || false,
          blockReason: data.blockReason,
          blockExpiry: data.blockExpiry?.toDate(),
          createdAt: data.createdAt?.toDate() || new Date(),
          lastLogin: data.lastLogin?.toDate() || new Date(),
          metadata: data.metadata || {
            characterCount: 0,
            messageCount: 0,
            flaggedContent: 0,
          },
        });
      });
    }
    
    return allUsers;
  } catch (error) {
    console.error('Error getting users by IDs:', error);
    return [];
  }
}

/**
 * Force sync all users from Firebase data
 */
export async function syncAllUsers(): Promise<number> {
  try {
    console.log('Starting manual user sync...');
    clearAdminCaches(); // Clear caches before sync
    const users = await getAllUsers(true); // Force refresh
    console.log(`Synced ${users.length} users`);
    return users.length;
  } catch (error) {
    console.error('Error syncing users:', error);
    throw error;
  }
}

/**
 * Get system analytics data
 */
export async function getSystemAnalytics(): Promise<any> {
  try {
    const { collection, getDocs, query, where, orderBy, limit } = await import('firebase/firestore');
    
    // Get basic counts
    const users = await getAllUsers();
    const totalUsers = users.length;
    
    // Calculate active users (simplified - users who logged in recently)
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const dailyActiveUsers = users.filter(u => u.lastLogin >= oneDayAgo).length;
    const weeklyActiveUsers = users.filter(u => u.lastLogin >= oneWeekAgo).length;
    const monthlyActiveUsers = users.filter(u => u.lastLogin >= oneMonthAgo).length;
    
    // Get character and message counts from user metadata
    let totalCharacters = 0;
    let totalMessages = 0;
    let flaggedUsers = 0;
    
    users.forEach(user => {
      totalCharacters += user.metadata.characterCount || 0;
      totalMessages += user.metadata.messageCount || 0;
      if (user.metadata.flaggedContent > 0) {
        flaggedUsers++;
      }
    });
    
    // Get popular characters (simplified)
    const characters = await getAllCharacters();
    const popularCharacters = characters
      .sort((a, b) => b.messageCount - a.messageCount)
      .slice(0, 10)
      .map(char => ({
        characterId: char.id,
        name: char.name,
        messageCount: char.messageCount,
        userCount: 1, // Simplified
      }));
    
    // Generate daily activity for last 7 days
    const dailyActivity = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      // Count users active on this day (simplified)
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      
      const activeUsersThisDay = users.filter(u => 
        u.lastLogin >= dayStart && u.lastLogin < dayEnd
      ).length;
      
      dailyActivity.push({
        date: dateStr,
        users: activeUsersThisDay,
        messages: Math.floor(activeUsersThisDay * 5), // Estimated messages
      });
    }
    
    // Generate peak hours (simplified)
    const peakHours = Array.from({ length: 24 }, (_, hour) => {
      // Simulate peak hours - higher activity during day hours
      if (hour >= 9 && hour <= 17) return Math.floor(Math.random() * 100) + 50;
      if (hour >= 18 && hour <= 22) return Math.floor(Math.random() * 80) + 30;
      return Math.floor(Math.random() * 20) + 5;
    });
    
    // Calculate growth (simplified - compare with previous period)
    const previousPeriodUsers = users.filter(u => 
      u.createdAt < oneMonthAgo
    ).length;
    const newUsers = totalUsers - previousPeriodUsers;
    const usersGrowth = previousPeriodUsers > 0 ? 
      Math.round((newUsers / previousPeriodUsers) * 100) : 0;
    
    return {
      totalUsers,
      activeUsers: {
        daily: dailyActiveUsers,
        weekly: weeklyActiveUsers,
        monthly: monthlyActiveUsers,
      },
      totalCharacters,
      totalMessages,
      popularCharacters,
      usagePatterns: {
        peakHours,
        dailyActivity,
      },
      flaggedContent: {
        characters: characters.filter(c => c.isFlagged).length,
        chats: 0, // Would need to implement chat flagging
        users: flaggedUsers,
      },
      growth: {
        usersGrowth,
        messagesGrowth: Math.floor(Math.random() * 20) - 10, // Simplified
        charactersGrowth: Math.floor(Math.random() * 15) - 5, // Simplified
      },
    };
  } catch (error) {
    console.error('Error getting system analytics:', error);
    // Return default analytics on error
    return {
      totalUsers: 0,
      activeUsers: { daily: 0, weekly: 0, monthly: 0 },
      totalCharacters: 0,
      totalMessages: 0,
      popularCharacters: [],
      usagePatterns: { peakHours: Array(24).fill(0), dailyActivity: [] },
      flaggedContent: { characters: 0, chats: 0, users: 0 },
      growth: { usersGrowth: 0, messagesGrowth: 0, charactersGrowth: 0 },
    };
  }
}

/**
 * Get recent admin action logs
 */
export async function getAdminActionLogs(limit = 20): Promise<any[]> {
  try {
    const { collection, getDocs, query, orderBy, limit: firestoreLimit } = await import('firebase/firestore');
    
    const actionsRef = collection(db, 'adminActions');
    const actionsQuery = query(
      actionsRef, 
      orderBy('timestamp', 'desc'), 
      firestoreLimit(limit)
    );
    const snapshot = await getDocs(actionsQuery);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date(),
    }));
  } catch (error) {
    console.error('Error getting admin action logs:', error);
    return [];
  }
}

/**
 * Log admin action with enhanced details
 */
export async function logAdminActionEnhanced(
  adminId: string,
  adminEmail: string,
  action: string,
  targetType: 'user' | 'character' | 'chat' | 'system',
  targetId: string,
  reason: string,
  details: Record<string, any> = {},
  impact?: string
): Promise<void> {
  try {
    const actionRef = doc(db, 'adminActions', `${Date.now()}_${adminId}_${Math.random().toString(36).substr(2, 9)}`);
    await setDoc(actionRef, {
      adminId,
      adminEmail,
      action,
      targetType,
      targetId,
      reason,
      details,
      impact: impact || 'low',
      timestamp: new Date(),
      ipAddress: 'unknown', // Would need to implement IP tracking
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    });
    
    console.log(`Admin action logged: ${action} on ${targetType} ${targetId} by ${adminEmail}`);
  } catch (error) {
    console.error('Error logging admin action:', error);
  }
}

// Cache for characters data
interface CharacterCache {
  characters: AdminCharacterView[];
  lastFetch: number;
  ttl: number;
}

const characterCache: CharacterCache = {
  characters: [],
  lastFetch: 0,
  ttl: 10 * 60 * 1000, // 10 minutes cache
};

/**
 * Get all characters for admin oversight with caching and pagination
 */
export async function getAllCharacters(forceRefresh = false, limit = 100): Promise<AdminCharacterView[]> {
  try {
    const now = Date.now();
    
    // Return cached data if still valid and not forcing refresh
    if (!forceRefresh && characterCache.characters.length > 0 && (now - characterCache.lastFetch) < characterCache.ttl) {
      console.log(`Returning ${characterCache.characters.length} cached characters`);
      return characterCache.characters.slice(0, limit);
    }
    
    const { collection, getDocs, query, orderBy, limit: firestoreLimit } = await import('firebase/firestore');
    
    const allCharacters: AdminCharacterView[] = [];
    
    // Get users from cache first to avoid expensive user lookup
    const users = await getAllUsers();
    
    // Process users in batches to avoid overwhelming the database
    const batchSize = 10;
    for (let i = 0; i < users.length; i += batchSize) {
      const userBatch = users.slice(i, i + batchSize);
      
      await Promise.all(userBatch.map(async (user) => {
        try {
          const charactersRef = collection(db, `users/${user.uid}/characters`);
          const charactersQuery = query(charactersRef, orderBy('lastUsed', 'desc'), firestoreLimit(20)); // Limit per user
          const charactersSnapshot = await getDocs(charactersQuery);
          
          charactersSnapshot.docs.forEach(doc => {
            const data = doc.data();
            
            allCharacters.push({
              id: doc.id,
              name: data.name || '',
              age: data.age || 0,
              profession: data.profession || '',
              tone: data.tone || '',
              description: data.description || '',
              createdAt: data.createdAt,
              lastUsed: data.lastUsed?.toDate() || new Date(),
              userId: user.uid,
              userName: user.displayName,
              userEmail: user.email,
              messageCount: data.messageCount || 0,
              isFlagged: data.isFlagged || false,
              flagReason: data.flagReason,
              reportCount: data.reportCount || 0,
            });
          });
        } catch (error) {
          console.log(`No characters found for user ${user.uid}`);
        }
      }));
    }
    
    // Sort by last used (most recent first)
    allCharacters.sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime());
    
    // Update cache
    characterCache.characters = allCharacters;
    characterCache.lastFetch = now;
    
    console.log(`Found ${allCharacters.length} characters across all users`);
    return allCharacters.slice(0, limit);
  } catch (error) {
    console.error('Error getting all characters:', error);
    return characterCache.characters.slice(0, limit); // Return cached data on error
  }
}

// Cache for chat sessions data
interface ChatCache {
  chats: AdminChatView[];
  lastFetch: number;
  ttl: number;
}

const chatCache: ChatCache = {
  chats: [],
  lastFetch: 0,
  ttl: 10 * 60 * 1000, // 10 minutes cache
};

/**
 * Get all chat sessions for admin monitoring with caching and pagination
 */
export async function getAllChatSessions(forceRefresh = false, limit = 100): Promise<AdminChatView[]> {
  try {
    const now = Date.now();
    
    // Return cached data if still valid and not forcing refresh
    if (!forceRefresh && chatCache.chats.length > 0 && (now - chatCache.lastFetch) < chatCache.ttl) {
      console.log(`Returning ${chatCache.chats.length} cached chat sessions`);
      return chatCache.chats.slice(0, limit);
    }
    
    const { collection, getDocs, query, orderBy, limit: firestoreLimit } = await import('firebase/firestore');
    
    const allChats: AdminChatView[] = [];
    
    // Get users from cache first
    const users = await getAllUsers();
    
    // Process users in batches to avoid overwhelming the database
    const batchSize = 10;
    for (let i = 0; i < users.length; i += batchSize) {
      const userBatch = users.slice(i, i + batchSize);
      
      await Promise.all(userBatch.map(async (user) => {
        try {
          // Get new structure chat sessions with limit
          const chatsRef = collection(db, `users/${user.uid}/chatSessions`);
          const chatsQuery = query(chatsRef, orderBy('lastMessageTime', 'desc'), firestoreLimit(10)); // Limit per user
          const chatsSnapshot = await getDocs(chatsQuery);
          
          chatsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            allChats.push({
              id: doc.id,
              name: data.name || '',
              characterId: data.characterId || '',
              characterData: data.characterData || {},
              lastMessage: data.lastMessage || '',
              lastMessageTime: data.lastMessageTime,
              createdAt: data.createdAt,
              messageCount: data.messageCount || 0,
              userId: user.uid,
              userName: user.displayName,
              userEmail: user.email,
              isFlagged: data.isFlagged || false,
              flagReason: data.flagReason,
              lastActivity: data.lastMessageTime?.toDate() || new Date(),
              totalMessages: data.messageCount || 0,
            });
          });
          
          // Only check for legacy messages if no modern chat sessions exist
          if (chatsSnapshot.size === 0) {
            try {
              const legacyMessagesRef = collection(db, `users/${user.uid}/messages`);
              const legacyQuery = query(legacyMessagesRef, firestoreLimit(1)); // Just check if any exist
              const legacySnapshot = await getDocs(legacyQuery);
              
              if (legacySnapshot.size > 0) {
                // Get a sample of legacy messages to create summary
                const legacyMessagesQuery = query(legacyMessagesRef, orderBy('createdAt', 'desc'), firestoreLimit(5));
                const legacyMessagesSnapshot = await getDocs(legacyMessagesQuery);
                const legacyMessages = legacyMessagesSnapshot.docs.map(doc => doc.data());
                const lastMessage = legacyMessages[0];
                
                // Get total count efficiently (this is still expensive but only for users with legacy data)
                const allLegacySnapshot = await getDocs(legacyMessagesRef);
                
                allChats.push({
                  id: `legacy-messages-${user.uid}`,
                  name: 'Legacy Messages',
                  characterId: 'legacy',
                  characterData: { 
                    name: 'Legacy Character', 
                    age: 0, 
                    profession: '', 
                    tone: '', 
                    description: 'Legacy character from old message structure' 
                  },
                  lastMessage: lastMessage?.text || 'Legacy message',
                  lastMessageTime: lastMessage?.createdAt || null,
                  createdAt: legacyMessages[legacyMessages.length - 1]?.createdAt || null,
                  messageCount: allLegacySnapshot.size,
                  userId: user.uid,
                  userName: user.displayName,
                  userEmail: user.email,
                  isFlagged: false,
                  flagReason: undefined,
                  lastActivity: lastMessage?.createdAt?.toDate() || new Date(),
                  totalMessages: allLegacySnapshot.size,
                });
              }
            } catch (legacyError) {
              // No legacy messages, which is fine
            }
          }
        } catch (error) {
          console.log(`No chat sessions found for user ${user.uid}`);
        }
      }));
    }
    
    // Sort by last activity (most recent first)
    allChats.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
    
    // Update cache
    chatCache.chats = allChats;
    chatCache.lastFetch = now;
    
    console.log(`Found ${allChats.length} chat sessions across all users`);
    return allChats.slice(0, limit);
  } catch (error) {
    console.error('Error getting all chat sessions:', error);
    return chatCache.chats.slice(0, limit); // Return cached data on error
  }
}

/**
 * Delete a character and all associated data
 */
export async function deleteCharacter(
  characterId: string,
  userId: string,
  reason: string,
  adminId: string,
  adminEmail: string
): Promise<void> {
  try {
    const { deleteDoc, collection, getDocs } = await import('firebase/firestore');
    
    // Delete character document
    const characterRef = doc(db, `users/${userId}/characters`, characterId);
    await deleteDoc(characterRef);
    
    // Delete all associated chat sessions and messages
    const chatSessionsRef = collection(db, `users/${userId}/chatSessions`);
    const chatSessionsSnapshot = await getDocs(chatSessionsRef);
    
    for (const sessionDoc of chatSessionsSnapshot.docs) {
      const sessionData = sessionDoc.data();
      if (sessionData.characterId === characterId) {
        // Delete messages in this session
        const messagesRef = collection(db, `users/${userId}/chatSessions/${sessionDoc.id}/messages`);
        const messagesSnapshot = await getDocs(messagesRef);
        
        for (const messageDoc of messagesSnapshot.docs) {
          await deleteDoc(messageDoc.ref);
        }
        
        // Delete the session
        await deleteDoc(sessionDoc.ref);
      }
    }
    
    // Log the action
    await logAdminAction(adminId, adminEmail, 'delete_character', 'character', characterId, reason, {
      userId,
      characterId,
    });
  } catch (error) {
    console.error('Error deleting character:', error);
    throw error;
  }
}

/**
 * Flag a character
 */
export async function flagCharacter(
  characterId: string,
  userId: string,
  reason: string,
  adminId: string,
  adminEmail: string
): Promise<void> {
  try {
    const characterRef = doc(db, `users/${userId}/characters`, characterId);
    await updateDoc(characterRef, {
      isFlagged: true,
      flagReason: reason,
      flaggedAt: new Date(),
      flaggedBy: adminId,
    });
    
    // Log the action
    await logAdminAction(adminId, adminEmail, 'flag_character', 'character', characterId, reason, {
      userId,
      characterId,
    });
  } catch (error) {
    console.error('Error flagging character:', error);
    throw error;
  }
}

/**
 * Unflag a character
 */
export async function unflagCharacter(
  characterId: string,
  userId: string,
  reason: string,
  adminId: string,
  adminEmail: string
): Promise<void> {
  try {
    const { deleteField } = await import('firebase/firestore');
    const characterRef = doc(db, `users/${userId}/characters`, characterId);
    await updateDoc(characterRef, {
      isFlagged: false,
      flagReason: deleteField(),
      flaggedAt: deleteField(),
      flaggedBy: deleteField(),
    });
    
    // Log the action
    await logAdminAction(adminId, adminEmail, 'unflag_character', 'character', characterId, reason, {
      userId,
      characterId,
    });
  } catch (error) {
    console.error('Error unflagging character:', error);
    throw error;
  }
}

/**
 * Flag a chat session
 */
export async function flagChatSession(
  chatId: string,
  userId: string,
  reason: string,
  adminId: string,
  adminEmail: string
): Promise<void> {
  try {
    const chatRef = doc(db, `users/${userId}/chatSessions`, chatId);
    await updateDoc(chatRef, {
      isFlagged: true,
      flagReason: reason,
      flaggedAt: new Date(),
      flaggedBy: adminId,
    });
    
    // Log the action
    await logAdminAction(adminId, adminEmail, 'flag_chat', 'chat', chatId, reason, {
      userId,
      chatId,
    });
  } catch (error) {
    console.error('Error flagging chat session:', error);
    throw error;
  }
}

/**
 * Unflag a chat session
 */
export async function unflagChatSession(
  chatId: string,
  userId: string,
  reason: string,
  adminId: string,
  adminEmail: string
): Promise<void> {
  try {
    const { deleteField } = await import('firebase/firestore');
    const chatRef = doc(db, `users/${userId}/chatSessions`, chatId);
    await updateDoc(chatRef, {
      isFlagged: false,
      flagReason: deleteField(),
      flaggedAt: deleteField(),
      flaggedBy: deleteField(),
    });
    
    // Log the action
    await logAdminAction(adminId, adminEmail, 'unflag_chat', 'chat', chatId, reason, {
      userId,
      chatId,
    });
  } catch (error) {
    console.error('Error unflagging chat session:', error);
    throw error;
  }
}

