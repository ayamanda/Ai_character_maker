'use client';

import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebase';
import { CharacterData, ChatSession } from '@/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  Users, 
  MessageCircle, 
  History, 
  Settings 
} from 'lucide-react';

// Import tab components
import CharactersTab from './tabs/CharactersTab';
import ChatTab from './tabs/ChatTab';
import HistoryTab from './tabs/HistoryTab';
import SignOutButton from './SignOutButton';

type TabType = 'characters' | 'chat' | 'history';

export default function MainInterface() {
  const [user] = useAuthState(auth);
  const [activeTab, setActiveTab] = useState<TabType>('characters');
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterData | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Handle character selection from Characters tab
  const handleCharacterSelect = (character: CharacterData) => {
    setSelectedCharacter(character);
    setActiveTab('chat');
  };

  // Handle session selection from History tab
  const handleSessionSelect = (sessionId: string, characterData: CharacterData) => {
    setCurrentSessionId(sessionId);
    setSelectedCharacter(characterData);
    setActiveTab('chat');
  };

  // Handle new chat creation
  const handleNewChat = () => {
    setCurrentSessionId(null);
    if (selectedCharacter) {
      setActiveTab('chat');
    }
  };

  if (!user) {
    return <div>Please sign in to continue</div>;
  }

  const tabs = [
    {
      id: 'characters' as TabType,
      label: 'Characters',
      icon: Users,
    },
    {
      id: 'chat' as TabType,
      label: 'Chat',
      icon: MessageCircle,
    },
    {
      id: 'history' as TabType,
      label: 'History',
      icon: History,
    },
  ];

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Tab Navigation */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "gap-2 transition-all duration-200",
                    activeTab === tab.id && "bg-primary text-primary-foreground shadow-sm"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </Button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings className="h-4 w-4" />
            </Button>
            <SignOutButton />
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'characters' && (
          <CharactersTab onCharacterSelect={handleCharacterSelect} />
        )}
        
        {activeTab === 'chat' && (
          <ChatTab
            selectedCharacter={selectedCharacter}
            currentSessionId={currentSessionId}
            setCurrentSessionId={setCurrentSessionId}
            onBackToCharacters={() => setActiveTab('characters')}
          />
        )}
        
        {activeTab === 'history' && (
          <HistoryTab onSessionSelect={handleSessionSelect} />
        )}
      </div>
    </div>
  );
}