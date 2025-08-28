import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageContentProps {
  content: string;
  isUser: boolean;
}

// Copy button component for code blocks
const CopyButton: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className={cn(
        "h-8 w-8 p-0 hover:bg-background/20 transition-colors",
        className
      )}
      title={copied ? "Copied!" : "Copy code"}
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </Button>
  );
};

// Enhanced code block component with copy button
const CodeBlock: React.FC<{ 
  language: string; 
  children: string; 
  className?: string;
}> = ({ language, children, className }) => {
  const codeText = String(children).replace(/\n$/, '');
  
  return (
    <div className="relative group my-4 first:mt-0 last:mb-0">
      <div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton text={codeText} />
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={language}
        PreTag="div"
        className={cn("rounded-md text-sm", className)}
      >
        {codeText}
      </SyntaxHighlighter>
    </div>
  );
};

// Enhanced inline code component with copy button
const InlineCode: React.FC<{ 
  children: React.ReactNode; 
  className?: string;
}> = ({ children, className, ...props }) => {
  const codeText = String(children);
  
  return (
    <span className="relative group inline-flex items-center">
      <code 
        className={cn(
          "bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-muted-foreground border",
          className
        )}
        {...props}
      >
        {children}
      </code>
      {codeText.length > 3 && (
        <CopyButton 
          text={codeText} 
          className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
        />
      )}
    </span>
  );
};

const MessageContent: React.FC<MessageContentProps> = ({ content, isUser }) => {
  // Handle empty or undefined content
  if (!content) {
    return <span className="text-muted-foreground italic">No content</span>;
  }

  // Custom renderers for consistent styling with the app's design system
  const components = {
    // Headers
    h1: ({ children }: any) => (
      <h1 className="text-2xl font-bold mb-4 mt-6 first:mt-0 text-foreground">
        {children}
      </h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-xl font-semibold mb-3 mt-5 first:mt-0 text-foreground">
        {children}
      </h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-lg font-semibold mb-2 mt-4 first:mt-0 text-foreground">
        {children}
      </h3>
    ),
    h4: ({ children }: any) => (
      <h4 className="text-base font-semibold mb-2 mt-3 first:mt-0 text-foreground">
        {children}
      </h4>
    ),
    h5: ({ children }: any) => (
      <h5 className="text-sm font-semibold mb-2 mt-3 first:mt-0 text-foreground">
        {children}
      </h5>
    ),
    h6: ({ children }: any) => (
      <h6 className="text-xs font-semibold mb-2 mt-3 first:mt-0 text-foreground">
        {children}
      </h6>
    ),
    
    // Code blocks with syntax highlighting
    code: ({ inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      
      if (!inline && language) {
        return (
          <CodeBlock 
            language={language} 
            className={className}
          >
            {children}
          </CodeBlock>
        );
      }
      
      // Inline code with copy button for longer snippets
      return (
        <InlineCode className={className} {...props}>
          {children}
        </InlineCode>
      );
    },
    
    // Pre blocks (fallback for code without language)
    pre: ({ children }: any) => {
      const codeText = typeof children === 'string' ? children : 
        React.Children.toArray(children).join('');
      
      return (
        <div className="relative group my-4 first:mt-0 last:mb-0">
          <div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
            <CopyButton text={codeText} />
          </div>
          <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm font-mono border">
            {children}
          </pre>
        </div>
      );
    },
    
    // Blockquotes
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-primary pl-4 py-2 my-4 first:mt-0 last:mb-0 bg-muted/50 rounded-r-md">
        <div className="text-muted-foreground italic">
          {children}
        </div>
      </blockquote>
    ),
    
    // Lists
    ul: ({ children }: any) => (
      <ul className="list-disc list-inside space-y-1 my-3 first:mt-0 last:mb-0 pl-4">
        {children}
      </ul>
    ),
    ol: ({ children }: any) => (
      <ol className="list-decimal list-inside space-y-1 my-3 first:mt-0 last:mb-0 pl-4">
        {children}
      </ol>
    ),
    li: ({ children }: any) => (
      <li className="text-foreground leading-relaxed">
        {children}
      </li>
    ),
    
    // Text formatting
    strong: ({ children }: any) => (
      <strong className="font-semibold text-foreground">
        {children}
      </strong>
    ),
    em: ({ children }: any) => (
      <em className="italic text-foreground">
        {children}
      </em>
    ),
    
    // Paragraphs
    p: ({ children }: any) => (
      <p className="mb-3 last:mb-0 leading-relaxed text-foreground">
        {children}
      </p>
    ),
    
    // Links
    a: ({ href, children }: any) => (
      <a 
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:text-primary/80 underline underline-offset-2"
      >
        {children}
      </a>
    ),
    
    // Tables
    table: ({ children }: any) => (
      <div className="overflow-x-auto my-4 first:mt-0 last:mb-0">
        <table className="min-w-full border-collapse border border-border rounded-md">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }: any) => (
      <thead className="bg-muted">
        {children}
      </thead>
    ),
    tbody: ({ children }: any) => (
      <tbody>
        {children}
      </tbody>
    ),
    tr: ({ children }: any) => (
      <tr className="border-b border-border">
        {children}
      </tr>
    ),
    th: ({ children }: any) => (
      <th className="border border-border px-3 py-2 text-left font-semibold text-foreground">
        {children}
      </th>
    ),
    td: ({ children }: any) => (
      <td className="border border-border px-3 py-2 text-foreground">
        {children}
      </td>
    ),
    
    // Horizontal rule
    hr: () => (
      <hr className="border-border my-6 first:mt-0 last:mb-0" />
    ),
  };

  return (
    <div className={cn(
      "text-sm leading-relaxed break-words prose prose-sm max-w-none",
      isUser ? "text-white prose-invert" : "text-card-foreground"
    )}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MessageContent;