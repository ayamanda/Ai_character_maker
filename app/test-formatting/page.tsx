'use client';
import MessageContent from '@/components/chat/MessageContent';

export default function TestFormattingPage() {
  const testCases = [
    {
      name: 'Bold text',
      content: 'This is **bold text** and this is normal.',
      isUser: false
    },
    {
      name: 'Italic text',
      content: 'This is *italic text* and this is normal.',
      isUser: false
    },
    {
      name: 'Inline code',
      content: 'Here is some `inline code` in a sentence.',
      isUser: false
    },
    {
      name: 'Code block with syntax highlighting',
      content: 'Here is a JavaScript code block:\n\n```javascript\nfunction greet(name) {\n  console.log(`Hello, ${name}!`);\n  return true;\n}\n```\n\nAnd a Python example:\n\n```python\ndef calculate_sum(a, b):\n    """Calculate the sum of two numbers"""\n    return a + b\n\nresult = calculate_sum(5, 3)\nprint(f"Result: {result}")\n```',
      isUser: false
    },
    {
      name: 'Headers',
      content: '# Main Header\n\n## Sub Header\n\n### Smaller Header\n\nSome content here.',
      isUser: false
    },
    {
      name: 'Bullet list',
      content: 'Here are some items:\n\n- First item\n- Second item\n- Third item with **bold** text',
      isUser: false
    },
    {
      name: 'Numbered list',
      content: 'Steps to follow:\n\n1. First step\n2. Second step\n3. Third step with `code`',
      isUser: false
    },
    {
      name: 'Blockquote',
      content: 'As someone once said:\n\n> This is a blockquote with some **bold** text\n> and multiple lines.',
      isUser: false
    },
    {
      name: 'Mixed formatting',
      content: 'This has **bold**, *italic*, `code`, and a list:\n\n- Item 1\n- Item 2\n\nAnd a code block:\n\n```python\nprint("Hello World")\n```',
      isUser: false
    },
    {
      name: 'User message with formatting',
      content: 'User message with **bold** and *italic* text.',
      isUser: true
    },
    {
      name: 'Empty content',
      content: '',
      isUser: false
    },
    {
      name: 'Copy button test',
      content: 'Test copy buttons:\n\n- Short inline code: `x = 5`\n- Longer inline code: `const myVariable = "Hello World"`\n- Code block:\n\n```bash\nnpm install react-markdown\nnpm run dev\necho "Copy this command!"\n```',
      isUser: false
    },
    {
      name: 'Plain text',
      content: 'Just plain text without any formatting.',
      isUser: false
    }
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">MessageContent Formatting Tests</h1>

      <div className="space-y-6">
        {testCases.map((testCase, index) => (
          <div key={index} className="border rounded-lg p-4">
            <h3 className="font-semibold mb-2 text-sm text-gray-600">
              Test {index + 1}: {testCase.name}
            </h3>

            <div className="mb-2">
              <strong>Input:</strong>
              <pre className="bg-gray-100 p-2 rounded text-xs mt-1 overflow-x-auto">
                {JSON.stringify(testCase.content)}
              </pre>
            </div>

            <div className="mb-2">
              <strong>Expected:</strong>
              <span className="text-sm text-gray-600 ml-2">
                {testCase.content.includes('**') && 'Should show bold text'}
                {testCase.content.includes('```') && 'Should show code block'}
                {testCase.content.includes("'''") && 'Should show code block'}
                {!testCase.content.includes('**') && !testCase.content.includes('```') && !testCase.content.includes("'''") && 'Plain text'}
              </span>
            </div>

            <div className="border-l-4 border-blue-500 pl-4">
              <strong>Actual Output:</strong>
              <div className="mt-2 p-3 bg-white border rounded">
                <MessageContent
                  content={testCase.content}
                  isUser={testCase.isUser}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <h3 className="font-semibold mb-2">Debug Instructions:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Open browser console (F12)</li>
          <li>Look for console logs from MessageContent component</li>
          <li>Check if formatting is applied correctly</li>
          <li>Compare expected vs actual output</li>
        </ol>
      </div>
    </div>
  );
}