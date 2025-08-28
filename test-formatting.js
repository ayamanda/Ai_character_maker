// Simple Node.js script to test the formatting logic
console.log('🧪 Testing MessageContent formatting logic...\n');

// Simulate the formatText function
function formatText(text) {
  console.log(`📝 Input: ${JSON.stringify(text)}`);
  
  // Very simple bold replacement
  if (text.includes('**')) {
    console.log('✅ Contains ** markers');
    const parts = text.split('**');
    console.log(`📝 Split parts:`, parts);
    
    const result = [];
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        // Regular text
        result.push(`<span>${parts[i]}</span>`);
      } else {
        // Bold text
        result.push(`<strong>${parts[i]}</strong>`);
      }
    }
    
    console.log(`📝 Result:`, result);
    return result.join('');
  }
  
  console.log('❌ No ** markers found');
  return `<span>${text}</span>`;
}

// Test cases
const testCases = [
  'This is **bold text** and this is normal.',
  'First **bold** and second **bold** text.',
  'No formatting here.',
  '**All bold**',
  '**Start bold** middle **end bold**',
  '',
  'Just ** one marker',
  '**unclosed bold',
  'closed bold**'
];

console.log('Running test cases:\n');

testCases.forEach((testCase, index) => {
  console.log(`\n--- Test ${index + 1} ---`);
  const result = formatText(testCase);
  console.log(`🎯 Final output: ${result}\n`);
});

console.log('\n🏁 Test completed!');