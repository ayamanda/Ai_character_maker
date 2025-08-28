'use client';

import React, { useState, useEffect } from 'react';
import { AdminChatView } from '@/types';
import { getUserChatSessions, logAdminAction } from '@/lib/admin';
import { useAdminAuth } from '@/lib/adminAuth';
import { useAdminUserContext } from '@/lib/adminUserContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Flag, Search, Filter, Calendar, User, Eye, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { doc, updateDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ChatMonitorProps {
  chats: AdminChatView[];
  onChatSelect?: (chatId: string) => void;
  onRefresh?: () => void;
  users?: { uid: string; displayName: string; email: string }[];
}

interface ChatFilters {
  search: string;
  flagged: 'all' | 'flagged' | 'unflagged';
  dateRange: 'all' | 'today' | 'week' | 'month';
  sortBy: 'lastActivity' | 'messageCount' | 'name';
  sortOrder: 'asc' | 'desc';
  selectedUser: 'all' | string;
}

interface Message {
  id: string;
  text: string;
  createdAt: any;
  uid: string;
  photoURL: string | null;
  displayName: string | null;
  character: boolean;
}

// Helper function to check if a chat is a legacy chat
const isLegacyChat = (chatId: string) => {
  return chatId === 'legacy-messages' || chatId.startsWith('legacy-messages-');
};

export function ChatMonitor({ chats: initialChats, onChatSelect, onRefresh, users = [] }: ChatMonitorProps) {
  const { user } = useAdminAuth();
  const { selectedUser } = useAdminUserContext();
  const [chats, setChats] = useState<AdminChatView[]>(initialChats);
  const [filteredChats, setFilteredChats] = useState<AdminChatView[]>(initialChats);
  const [loading, setLoading] = useState(false);
  const [selectedChat, setSelectedChat] = useState<AdminChatView | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [actionReason, setActionReason] = useState('');
  const [filters, setFilters] = useState<ChatFilters>({
    search: '',
    flagged: 'all',
    dateRange: 'all',
    sortBy: 'lastActivity',
    sortOrder: 'desc',
    selectedUser: 'all',
  });

  // Update chats when prop changes
  useEffect(() => {
    setChats(initialChats);
  }, [initialChats]);

  // Apply filters and sorting
  useEffect(() => {
    let filtered = [...chats];

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(chat => 
        chat.name.toLowerCase().includes(searchLower) ||
        chat.lastMessage.toLowerCase().includes(searchLower) ||
        chat.userName.toLowerCase().includes(searchLower) ||
        chat.userEmail.toLowerCase().includes(searchLower) ||
        chat.characterData.name.toLowerCase().includes(searchLower)
      );
    }

    // Apply flagged filter
    if (filters.flagged !== 'all') {
      filtered = filtered.filter(chat => 
        filters.flagged === 'flagged' ? chat.isFlagged : !chat.isFlagged
      );
    }

    // Apply user filter from context or local filter
    const userFilter = selectedUser?.uid || filters.selectedUser;
    if (userFilter !== 'all') {
      filtered = filtered.filter(chat => chat.userId === userFilter);
    }

    // Apply date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();
      
      switch (filters.dateRange) {
        case 'today':
          cutoffDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
      }
      
      filtered = filtered.filter(chat => 
        chat.lastActivity >= cutoffDate
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (filters.sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'lastActivity':
          aValue = a.lastActivity.getTime();
          bValue = b.lastActivity.getTime();
          break;
        case 'messageCount':
          aValue = a.totalMessages;
          bValue = b.totalMessages;
          break;
        default:
          return 0;
      }

      if (filters.sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    setFilteredChats(filtered);
  }, [chats, filters, selectedUser]);

  const loadChatMessages = async (chat: AdminChatView) => {
    setLoadingMessages(true);
    try {
      let messages: Message[] = [];

      if (isLegacyChat(chat.id)) {
        // Load legacy messages
        const messagesRef = collection(db, `users/${chat.userId}/messages`);
        const messagesQuery = query(messagesRef, orderBy('createdAt', 'asc'));
        const messagesSnapshot = await getDocs(messagesQuery);
        
        messages = messagesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            text: data.text || '',
            createdAt: data.createdAt,
            uid: data.uid || '',
            photoURL: data.photoURL || null,
            displayName: data.displayName || null,
            character: data.character === true, // Ensure boolean conversion
          } as Message;
        });
        
        console.log('Loaded legacy messages:', messages.length, messages);
      } else {
        // Load messages from chat session
        const messagesRef = collection(db, `users/${chat.userId}/chatSessions/${chat.id}/messages`);
        const messagesQuery = query(messagesRef, orderBy('createdAt', 'asc'));
        const messagesSnapshot = await getDocs(messagesQuery);
        
        messages = messagesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Message));
      }

      setChatMessages(messages);
    } catch (error) {
      console.error('Error loading chat messages:', error);
      setChatMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleChatAction = async (chat: AdminChatView, type: 'flag' | 'unflag', reason: string) => {
    if (!user || isLegacyChat(chat.id)) return;

    setLoading(true);
    try {
      const chatRef = doc(db, `users/${chat.userId}/chatSessions`, chat.id);

      switch (type) {
        case 'flag':
          await updateDoc(chatRef, {
            isFlagged: true,
            flagReason: reason,
            flaggedAt: new Date(),
            flaggedBy: user.uid,
          });
          
          // Update local state
          setChats(prev => prev.map(c => 
            c.id === chat.id 
              ? { ...c, isFlagged: true, flagReason: reason }
              : c
          ));
          break;

        case 'unflag':
          await updateDoc(chatRef, {
            isFlagged: false,
            flagReason: null,
            flaggedAt: null,
            flaggedBy: null,
          });
          
          // Update local state
          setChats(prev => prev.map(c => 
            c.id === chat.id 
              ? { ...c, isFlagged: false, flagReason: undefined }
              : c
          ));
          break;
      }

      // Log the admin action
      await logAdminAction(
        user.uid,
        user.email || '',
        `${type}_chat`,
        'chat',
        chat.id,
        reason,
        {
          chatName: chat.name,
          userId: chat.userId,
          userEmail: chat.userEmail,
          characterName: chat.characterData.name,
        }
      );

      // Reset dialog state
      setActionReason('');

      // Refresh if callback provided
      if (onRefresh) {
        onRefresh();
      }

    } catch (error) {
      console.error(`Error ${type}ging chat:`, error);
      alert(`Failed to ${type} chat. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatMessageTime = (timestamp: any) => {
    if (!timestamp) return 'Unknown time';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Chat Monitor</h2>
          <p className="text-muted-foreground">
            Monitor and moderate user conversations
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary">
            {filteredChats.length} of {chats.length} chats
          </Badge>
          {onRefresh && (
            <Button onClick={onRefresh} variant="outline" size="sm">
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search chats, users, characters..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10"
              />
            </div>
            
            <Select value={filters.flagged} onValueChange={(value: any) => setFilters(prev => ({ ...prev, flagged: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Chats</SelectItem>
                <SelectItem value="flagged">Flagged Only</SelectItem>
                <SelectItem value="unflagged">Not Flagged</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.dateRange} onValueChange={(value: any) => setFilters(prev => ({ ...prev, dateRange: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last Week</SelectItem>
                <SelectItem value="month">Last Month</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.sortBy} onValueChange={(value: any) => setFilters(prev => ({ ...prev, sortBy: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lastActivity">Last Activity</SelectItem>
                <SelectItem value="messageCount">Message Count</SelectItem>
                <SelectItem value="name">Chat Name</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.sortOrder} onValueChange={(value: any) => setFilters(prev => ({ ...prev, sortOrder: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Descending</SelectItem>
                <SelectItem value="asc">Ascending</SelectItem>
              </SelectContent>
            </Select>


          </div>
        </CardContent>
      </Card>

      {/* Chats List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredChats.map((chat) => (
          <Card key={`${chat.userId}-${chat.id}`} className={cn(
            "relative",
            chat.isFlagged && "border-destructive"
          )}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="flex items-center">
                    {chat.name}
                    {chat.isFlagged && (
                      <AlertTriangle className="h-4 w-4 ml-2 text-destructive" />
                    )}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    with {chat.characterData.name}
                  </p>
                </div>
                <div className="flex space-x-1">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedChat(chat);
                          loadChatMessages(chat);
                          if (onChatSelect) {
                            onChatSelect(chat.id);
                          }
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh]">
                      <DialogHeader>
                        <DialogTitle>
                          Chat: {chat.name} - {chat.characterData.name}
                        </DialogTitle>
                      </DialogHeader>
                      <ScrollArea className="h-[60vh] w-full">
                        {loadingMessages ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="text-muted-foreground">Loading messages...</div>
                          </div>
                        ) : chatMessages.length > 0 ? (
                          <div className="space-y-4 p-4">
                            {chatMessages.map((message) => (
                              <div
                                key={message.id}
                                className={cn(
                                  "flex",
                                  message.character ? "justify-start" : "justify-end"
                                )}
                              >
                                <div
                                  className={cn(
                                    "max-w-[70%] rounded-lg px-4 py-2",
                                    message.character
                                      ? "bg-muted text-foreground"
                                      : "bg-primary text-primary-foreground"
                                  )}
                                >
                                  <div className="text-sm font-medium mb-1">
                                    {message.character 
                                      ? (isLegacyChat(chat.id) ? 'AI Assistant' : chat.characterData.name)
                                      : (message.displayName || 'User')
                                    }
                                  </div>
                                  <div className="text-sm whitespace-pre-wrap">
                                    {message.text}
                                  </div>
                                  <div className="text-xs opacity-70 mt-1">
                                    {formatMessageTime(message.createdAt)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center py-8">
                            <div className="text-muted-foreground">No messages found</div>
                          </div>
                        )}
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>

                  {!isLegacyChat(chat.id) && (
                    <>
                      {!chat.isFlagged ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Flag className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Flag Chat</AlertDialogTitle>
                              <AlertDialogDescription>
                                Flag "{chat.name}" for review. This will mark the chat as potentially inappropriate.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="space-y-4">
                              <Textarea
                                placeholder="Reason for flagging..."
                                value={actionReason}
                                onChange={(e) => setActionReason(e.target.value)}
                              />
                            </div>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setActionReason('')}>
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleChatAction(chat, 'flag', actionReason)}
                                disabled={!actionReason.trim() || loading}
                              >
                                Flag Chat
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Flag className="h-4 w-4 fill-current" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Unflag Chat</AlertDialogTitle>
                              <AlertDialogDescription>
                                Remove the flag from "{chat.name}". This will mark the chat as appropriate.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="space-y-4">
                              <Textarea
                                placeholder="Reason for unflagging..."
                                value={actionReason}
                                onChange={(e) => setActionReason(e.target.value)}
                              />
                            </div>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setActionReason('')}>
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleChatAction(chat, 'unflag', actionReason)}
                                disabled={!actionReason.trim() || loading}
                              >
                                Unflag Chat
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  Last message: {chat.lastMessage}
                </p>
                
                {chat.isFlagged && chat.flagReason && (
                  <div className="p-2 bg-destructive/10 border border-destructive/20 rounded">
                    <p className="text-sm text-destructive font-medium">Flagged:</p>
                    <p className="text-sm text-destructive">{chat.flagReason}</p>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <User className="h-4 w-4 mr-1" />
                    {chat.userName || chat.userEmail}
                  </div>
                  <div className="flex items-center">
                    <MessageSquare className="h-4 w-4 mr-1" />
                    {chat.totalMessages} messages
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    {formatDate(chat.lastActivity)}
                  </div>
                  {isLegacyChat(chat.id) && (
                    <Badge variant="outline" className="text-xs">
                      Legacy
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredChats.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              {chats.length === 0 
                ? "No chats found." 
                : "No chats match your current filters."
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}