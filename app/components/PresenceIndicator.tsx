"use client";

import { usePresenceStore } from '@/app/store/usePresenceStore';
import { useAuthStore } from '@/app/store/useAuthStore';

export default function PresenceIndicator() {
  const onlineUsers = usePresenceStore((state) => state.onlineUsers);
  const connectionState = usePresenceStore((state) => state.connectionState);
  const { user } = useAuthStore();

  const getStatusColor = () => {
    switch (connectionState) {
      case 'connected':
        return 'bg-green-500';
      case 'reconnecting':
        return 'bg-yellow-500 animate-pulse';
      case 'offline':
        return 'bg-red-500';
    }
  };

  const getStatusText = () => {
    switch (connectionState) {
      case 'connected':
        return 'Connected';
      case 'reconnecting':
        return 'Reconnecting...';
      case 'offline':
        return 'Offline';
    }
  };

  return (
    <div className="absolute top-4 right-4 z-10 p-4 bg-black backdrop-blur-md rounded-lg text-white min-w-[250px]">
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${getStatusColor()} transition-all duration-300`} />
          <span className="text-sm font-medium">{getStatusText()}</span>
        </div>

        <div className="w-px h-6 bg-white/20" />

        <div className="flex items-center space-x-2">
          <svg 
            className="w-5 h-5" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" 
            />
          </svg>
          <span className="text-sm font-medium">
            {onlineUsers.length} online
          </span>
        </div>
      </div>

      {onlineUsers.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="text-xs text-white/60 mb-2">Active Users</div>
          <div className="space-y-2">
            {onlineUsers.slice(0, 5).map((presenceUser) => {
              const isCurrentUser = presenceUser.userId === user?.id;
              return (
                <div
                  key={presenceUser.userId}
                  className={`flex items-center space-x-2 p-2 rounded ${
                    isCurrentUser ? 'bg-green-500/20' : 'bg-white/5'
                  }`}
                >
                  <img
                    src={presenceUser.avatar || `https://ui-avatars.com/api/?name=${presenceUser.name || presenceUser.email}&background=random`}
                    alt={presenceUser.name || 'User'}
                    className="w-6 h-6 rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {presenceUser.name || presenceUser.email?.split('@')[0]}
                      {isCurrentUser && ' (You)'}
                    </p>
                  </div>
                </div>
              );
            })}
            {onlineUsers.length > 5 && (
              <p className="text-xs text-white/60 text-center">
                +{onlineUsers.length - 5} more
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}