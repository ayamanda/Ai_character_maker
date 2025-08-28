import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    // This endpoint should be called periodically (e.g., via cron job)
    // to update user metadata in the background
    
    const { searchParams } = new URL(request.url);
    const batchSize = parseInt(searchParams.get('batchSize') || '10');
    const maxUsers = parseInt(searchParams.get('maxUsers') || '50');
    
    console.log(`Starting metadata sync for up to ${maxUsers} users in batches of ${batchSize}`);
    
    // Get admin users that need metadata updates
    const adminUsersRef = collection(db, 'adminUsers');
    const adminSnapshot = await getDocs(adminUsersRef);
    
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    const usersToUpdate = adminSnapshot.docs
      .filter(doc => {
        const data = doc.data();
        const metadataAge = data.metadataUpdated?.toDate?.()?.getTime() || 0;
        return metadataAge < oneHourAgo; // Update if older than 1 hour
      })
      .slice(0, maxUsers); // Limit to prevent overwhelming the system
    
    console.log(`Found ${usersToUpdate.length} users needing metadata updates`);
    
    let updatedCount = 0;
    const errors: string[] = [];
    
    // Process users in batches
    for (let i = 0; i < usersToUpdate.length; i += batchSize) {
      const batch = usersToUpdate.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (userDoc) => {
        const userId = userDoc.id;
        const userData = userDoc.data();
        
        try {
          let characterCount = 0;
          let messageCount = 0;
          let flaggedContent = 0;
          
          // Count characters
          const charactersRef = collection(db, `users/${userId}/characters`);
          const charactersSnapshot = await getDocs(charactersRef);
          characterCount = charactersSnapshot.size;
          
          // Count flagged characters
          charactersSnapshot.docs.forEach(doc => {
            if (doc.data().isFlagged) {
              flaggedContent++;
            }
          });
          
          // Count messages from chat sessions
          const sessionsRef = collection(db, `users/${userId}/chatSessions`);
          const sessionsSnapshot = await getDocs(sessionsRef);
          
          sessionsSnapshot.docs.forEach(sessionDoc => {
            const sessionData = sessionDoc.data();
            messageCount += sessionData.messageCount || 0;
            if (sessionData.isFlagged) {
              flaggedContent++;
            }
          });
          
          // Count legacy messages only if no sessions exist
          if (sessionsSnapshot.size === 0) {
            try {
              const legacyMessagesRef = collection(db, `users/${userId}/messages`);
              const legacyMessagesSnapshot = await getDocs(legacyMessagesRef);
              messageCount += legacyMessagesSnapshot.size;
            } catch (legacyError) {
              // No legacy messages, which is fine
            }
          }
          
          // Update metadata
          await updateDoc(doc(db, 'adminUsers', userId), {
            metadata: {
              characterCount,
              messageCount,
              flaggedContent,
            },
            metadataUpdated: new Date(),
          });
          
          updatedCount++;
          console.log(`Updated metadata for user ${userId}: ${characterCount} characters, ${messageCount} messages`);
          
        } catch (error) {
          const errorMsg = `Failed to update metadata for user ${userId}: ${error}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }));
      
      // Small delay between batches to avoid overwhelming the database
      if (i + batchSize < usersToUpdate.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    const result = {
      success: true,
      message: `Metadata sync completed`,
      stats: {
        totalUsersChecked: adminSnapshot.size,
        usersNeedingUpdate: usersToUpdate.length,
        usersUpdated: updatedCount,
        errors: errors.length,
      },
      errors: errors.slice(0, 10), // Limit error details
    };
    
    console.log('Metadata sync result:', result);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('Error in metadata sync:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Metadata sync failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}