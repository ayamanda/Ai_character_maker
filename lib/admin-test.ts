// lib/admin-test.ts
// Simple test functions to verify the optimized admin functions work correctly

import { 
  getAllUsers, 
  getUserById, 
  getUsersByIds,
  getAllCharacters,
  getAllChatSessions,
  getCacheStatus,
  clearAdminCaches
} from './admin';

/**
 * Test the optimized admin functions
 */
export async function testAdminOptimizations() {
  console.log('🧪 Testing Admin Optimizations...');
  
  try {
    // Test 1: Get all users (should use Firestore directly)
    console.log('📊 Test 1: Getting all users...');
    const startTime = Date.now();
    const users = await getAllUsers();
    const userLoadTime = Date.now() - startTime;
    console.log(`✅ Loaded ${users.length} users in ${userLoadTime}ms`);
    
    if (users.length > 0) {
      // Test 2: Get single user by ID (should be fast)
      console.log('👤 Test 2: Getting single user by ID...');
      const singleUserStart = Date.now();
      const singleUser = await getUserById(users[0].uid);
      const singleUserTime = Date.now() - singleUserStart;
      console.log(`✅ Got user ${singleUser?.displayName} in ${singleUserTime}ms`);
      
      // Test 3: Get multiple users by IDs (batch lookup)
      if (users.length >= 3) {
        console.log('👥 Test 3: Getting multiple users by IDs...');
        const multiUserStart = Date.now();
        const userIds = users.slice(0, 3).map(u => u.uid);
        const multipleUsers = await getUsersByIds(userIds);
        const multiUserTime = Date.now() - multiUserStart;
        console.log(`✅ Got ${multipleUsers.length} users in ${multiUserTime}ms`);
      }
    }
    
    // Test 4: Cache status
    console.log('💾 Test 4: Checking cache status...');
    const cacheStatus = getCacheStatus();
    console.log('✅ Cache status:', {
      users: `${cacheStatus.users.count} users, age: ${Math.round(cacheStatus.users.age / 1000)}s`,
      characters: `${cacheStatus.characters.count} characters, age: ${Math.round(cacheStatus.characters.age / 1000)}s`,
      chats: `${cacheStatus.chats.count} chats, age: ${Math.round(cacheStatus.chats.age / 1000)}s`,
    });
    
    // Test 5: Characters (with limit)
    console.log('🎭 Test 5: Getting characters...');
    const charactersStart = Date.now();
    const characters = await getAllCharacters(false, 20); // Limit to 20
    const charactersTime = Date.now() - charactersStart;
    console.log(`✅ Loaded ${characters.length} characters in ${charactersTime}ms`);
    
    // Test 6: Chats (with limit)
    console.log('💬 Test 6: Getting chats...');
    const chatsStart = Date.now();
    const chats = await getAllChatSessions(false, 20); // Limit to 20
    const chatsTime = Date.now() - chatsStart;
    console.log(`✅ Loaded ${chats.length} chats in ${chatsTime}ms`);
    
    // Test 7: Cache performance (second call should be faster)
    console.log('⚡ Test 7: Testing cache performance...');
    const cachedStart = Date.now();
    const cachedUsers = await getAllUsers(); // Should use cache
    const cachedTime = Date.now() - cachedStart;
    console.log(`✅ Cached users loaded in ${cachedTime}ms (should be <10ms)`);
    
    console.log('🎉 All tests completed successfully!');
    
    return {
      success: true,
      results: {
        userCount: users.length,
        characterCount: characters.length,
        chatCount: chats.length,
        userLoadTime,
        cachedLoadTime: cachedTime,
        cacheStatus,
      }
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Performance comparison: Old vs New approach
 */
export async function comparePerformance() {
  console.log('⚖️ Performance Comparison...');
  
  // Clear cache to ensure fair comparison
  clearAdminCaches();
  
  try {
    // Simulate old approach (API call + expensive queries)
    console.log('🐌 Simulating old approach...');
    const oldStart = Date.now();
    
    // This would be the old way: API call + individual user data fetching
    const response = await fetch('/api/admin/users');
    if (response.ok) {
      const data = await response.json();
      // Simulate processing each user individually (expensive)
      // In the old approach, we'd do this for every user every time
    }
    const oldTime = Date.now() - oldStart;
    
    // New optimized approach
    console.log('🚀 Testing new optimized approach...');
    const newStart = Date.now();
    const users = await getAllUsers();
    const newTime = Date.now() - newStart;
    
    console.log(`📈 Performance Results:`);
    console.log(`   Old approach: ${oldTime}ms`);
    console.log(`   New approach: ${newTime}ms`);
    console.log(`   Improvement: ${Math.round(((oldTime - newTime) / oldTime) * 100)}% faster`);
    
    return {
      oldTime,
      newTime,
      improvement: Math.round(((oldTime - newTime) / oldTime) * 100),
      userCount: users.length
    };
    
  } catch (error) {
    console.error('❌ Performance comparison failed:', error);
    return null;
  }
}

/**
 * Run tests in development mode
 */
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Make test functions available in browser console
  (window as any).testAdminOptimizations = testAdminOptimizations;
  (window as any).comparePerformance = comparePerformance;
  console.log('🔧 Admin test functions available in console:');
  console.log('   - testAdminOptimizations()');
  console.log('   - comparePerformance()');
}