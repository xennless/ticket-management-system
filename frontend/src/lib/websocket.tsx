/**
 * WebSocket Hook for Real-time Updates
 * 
 * WebSocket bağlantısı yönetimi ve real-time güncellemeler
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { getToken } from './api';

export type WebSocketMessage = 
  | { type: 'ticket.updated'; data: { ticketId: string } }
  | { type: 'ticket.created'; data: { ticketId: string } }
  | { type: 'notification.new'; data: { notificationId: string } }
  | { type: 'message.new'; data: { ticketId: string; messageId: string } }
  | { type: 'user.online'; data: { userId: string } }
  | { type: 'user.offline'; data: { userId: string } }
  | { type: 'pong' }
  | { type: 'error'; data: { message: string } };

type MessageHandler = (message: WebSocketMessage) => void;

class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private handlers: Set<MessageHandler> = new Set();
  private heartbeatInterval: number | null = null;

  constructor(baseUrl: string = '') {
    // WebSocket URL - backend'den alınacak veya env'den
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = baseUrl || window.location.host;
    this.url = `${wsProtocol}//${wsHost}/ws`;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    const token = getToken();
    if (!token) {
      console.warn('[WebSocket] No token available, skipping connection');
      return;
    }

    try {
      this.ws = new WebSocket(`${this.url}?token=${token}`);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected');
        this.reconnectAttempts = 0;
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          if (message.type === 'pong') {
            return; // Heartbeat response
          }

          // Notify all handlers
          this.handlers.forEach(handler => {
            try {
              handler(message);
            } catch (error) {
              console.error('[WebSocket] Handler error:', error);
            }
          });
        } catch (error) {
          console.error('[WebSocket] Parse error:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };

      this.ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        this.stopHeartbeat();
        this.reconnect();
      };
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      this.reconnect();
    }
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  subscribe(handler: MessageHandler) {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  private reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHeartbeat() {
    this.heartbeatInterval = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // 30 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  send(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] Cannot send message, connection not open');
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Global WebSocket instance
let wsManager: WebSocketManager | null = null;

function getWebSocketManager(): WebSocketManager {
  if (!wsManager) {
    wsManager = new WebSocketManager();
  }
  return wsManager;
}

/**
 * Hook for WebSocket real-time updates
 * 
 * @example
 * ```tsx
 * const { isConnected, send } = useWebSocket((message) => {
 *   if (message.type === 'ticket.updated') {
 *     queryClient.invalidateQueries(['tickets']);
 *   }
 * });
 * ```
 */
export function useWebSocket(onMessage?: MessageHandler) {
  const [isConnected, setIsConnected] = useState(false);
  const managerRef = useRef<WebSocketManager | null>(null);

  useEffect(() => {
    const manager = getWebSocketManager();
    managerRef.current = manager;

    // Subscribe to messages
    let unsubscribe: (() => void) | null = null;
    if (onMessage) {
      unsubscribe = manager.subscribe(onMessage);
    }

    // Subscribe to connection status
    const statusHandler: MessageHandler = () => {
      setIsConnected(manager.isConnected());
    };
    const statusUnsubscribe = manager.subscribe(statusHandler);

    // Connect
    manager.connect();
    setIsConnected(manager.isConnected());

    return () => {
      if (unsubscribe) unsubscribe();
      statusUnsubscribe();
      // Don't disconnect on unmount - keep connection alive for other components
    };
  }, [onMessage]);

  const send = useCallback((message: any) => {
    if (managerRef.current) {
      managerRef.current.send(message);
    }
  }, []);

  return {
    isConnected,
    send,
    reconnect: () => {
      if (managerRef.current) {
        managerRef.current.disconnect();
        managerRef.current.connect();
      }
    },
  };
}

