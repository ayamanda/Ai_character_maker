// lib/analytics.ts
import { db } from './firebase';
import { doc, setDoc, getDoc, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

interface AnalyticsEvent {
  type: 'user_login' | 'user_signup' | 'character_created' | 'message_sent' | 'chat_started';
  userId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface DailyAnalytics {
  date: string;
  newUsers: number;
  activeUsers: number;
  charactersCreated: number;
  messagesSent: number;
  chatsStarted: number;
  peakHour: number;
  hourlyActivity: number[];
}

/**
 * Track an analytics event
 */
export async function trackEvent(event: AnalyticsEvent): Promise<void> {
  try {
    const eventRef = doc(collection(db, 'analyticsEvents'));
    await setDoc(eventRef, {
      ...event,
      timestamp: event.timestamp,
      id: eventRef.id,
    });
    
    // Update daily aggregates in background
    updateDailyAnalytics(event);
  } catch (error) {
    console.error('Error tracking analytics event:', error);
  }
}

/**
 * Update daily analytics aggregates
 */
async function updateDailyAnalytics(event: AnalyticsEvent): Promise<void> {
  try {
    const dateStr = event.timestamp.toISOString().split('T')[0];
    const hour = event.timestamp.getHours();
    
    const dailyRef = doc(db, 'dailyAnalytics', dateStr);
    const dailyDoc = await getDoc(dailyRef);
    
    let dailyData: DailyAnalytics;
    
    if (dailyDoc.exists()) {
      dailyData = dailyDoc.data() as DailyAnalytics;
    } else {
      dailyData = {
        date: dateStr,
        newUsers: 0,
        activeUsers: 0,
        charactersCreated: 0,
        messagesSent: 0,
        chatsStarted: 0,
        peakHour: 0,
        hourlyActivity: Array(24).fill(0),
      };
    }
    
    // Update counters based on event type
    switch (event.type) {
      case 'user_signup':
        dailyData.newUsers++;
        break;
      case 'user_login':
        dailyData.activeUsers++;
        break;
      case 'character_created':
        dailyData.charactersCreated++;
        break;
      case 'message_sent':
        dailyData.messagesSent++;
        break;
      case 'chat_started':
        dailyData.chatsStarted++;
        break;
    }
    
    // Update hourly activity
    dailyData.hourlyActivity[hour]++;
    
    // Update peak hour
    const maxActivity = Math.max(...dailyData.hourlyActivity);
    dailyData.peakHour = dailyData.hourlyActivity.indexOf(maxActivity);
    
    await setDoc(dailyRef, dailyData);
  } catch (error) {
    console.error('Error updating daily analytics:', error);
  }
}

/**
 * Get analytics for a date range
 */
export async function getAnalyticsForDateRange(
  startDate: Date,
  endDate: Date
): Promise<DailyAnalytics[]> {
  try {
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    const analyticsRef = collection(db, 'dailyAnalytics');
    const analyticsQuery = query(
      analyticsRef,
      where('date', '>=', startDateStr),
      where('date', '<=', endDateStr),
      orderBy('date', 'asc')
    );
    
    const snapshot = await getDocs(analyticsQuery);
    return snapshot.docs.map(doc => doc.data() as DailyAnalytics);
  } catch (error) {
    console.error('Error getting analytics for date range:', error);
    return [];
  }
}

/**
 * Get recent analytics events
 */
export async function getRecentEvents(
  eventType?: AnalyticsEvent['type'],
  limitCount = 100
): Promise<AnalyticsEvent[]> {
  try {
    const eventsRef = collection(db, 'analyticsEvents');
    let eventsQuery = query(
      eventsRef,
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    
    if (eventType) {
      eventsQuery = query(
        eventsRef,
        where('type', '==', eventType),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
    }
    
    const snapshot = await getDocs(eventsQuery);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date(),
    })) as AnalyticsEvent[];
  } catch (error) {
    console.error('Error getting recent events:', error);
    return [];
  }
}

/**
 * Track user login
 */
export async function trackUserLogin(userId: string, metadata?: Record<string, any>): Promise<void> {
  await trackEvent({
    type: 'user_login',
    userId,
    timestamp: new Date(),
    metadata,
  });
}

/**
 * Track user signup
 */
export async function trackUserSignup(userId: string, metadata?: Record<string, any>): Promise<void> {
  await trackEvent({
    type: 'user_signup',
    userId,
    timestamp: new Date(),
    metadata,
  });
}

/**
 * Track character creation
 */
export async function trackCharacterCreated(
  userId: string,
  characterId: string,
  characterName: string
): Promise<void> {
  await trackEvent({
    type: 'character_created',
    userId,
    timestamp: new Date(),
    metadata: {
      characterId,
      characterName,
    },
  });
}

/**
 * Track message sent
 */
export async function trackMessageSent(
  userId: string,
  characterId: string,
  messageLength: number
): Promise<void> {
  await trackEvent({
    type: 'message_sent',
    userId,
    timestamp: new Date(),
    metadata: {
      characterId,
      messageLength,
    },
  });
}

/**
 * Track chat started
 */
export async function trackChatStarted(
  userId: string,
  characterId: string,
  characterName: string
): Promise<void> {
  await trackEvent({
    type: 'chat_started',
    userId,
    timestamp: new Date(),
    metadata: {
      characterId,
      characterName,
    },
  });
}

/**
 * Generate analytics summary for admin dashboard
 */
export async function generateAnalyticsSummary(): Promise<any> {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const dailyAnalytics = await getAnalyticsForDateRange(thirtyDaysAgo, now);
    
    const summary = {
      totalNewUsers: dailyAnalytics.reduce((sum, day) => sum + day.newUsers, 0),
      totalActiveUsers: dailyAnalytics.reduce((sum, day) => sum + day.activeUsers, 0),
      totalCharactersCreated: dailyAnalytics.reduce((sum, day) => sum + day.charactersCreated, 0),
      totalMessagesSent: dailyAnalytics.reduce((sum, day) => sum + day.messagesSent, 0),
      totalChatsStarted: dailyAnalytics.reduce((sum, day) => sum + day.chatsStarted, 0),
      averageDailyUsers: Math.round(
        dailyAnalytics.reduce((sum, day) => sum + day.activeUsers, 0) / Math.max(dailyAnalytics.length, 1)
      ),
      peakUsageHours: calculatePeakHours(dailyAnalytics),
      dailyTrends: dailyAnalytics.slice(-7), // Last 7 days
    };
    
    return summary;
  } catch (error) {
    console.error('Error generating analytics summary:', error);
    return null;
  }
}

/**
 * Calculate peak usage hours from daily analytics
 */
function calculatePeakHours(dailyAnalytics: DailyAnalytics[]): number[] {
  const hourlyTotals = Array(24).fill(0);
  
  dailyAnalytics.forEach(day => {
    day.hourlyActivity.forEach((activity, hour) => {
      hourlyTotals[hour] += activity;
    });
  });
  
  return hourlyTotals;
}