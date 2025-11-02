import type { GraphQLResolveInfo } from 'graphql';
import type { FastifyRequest } from 'fastify';

export interface ISubscriptionPayload<T = any> {
  data: T;
  metadata?: {
    timestamp: Date;
    source: string;
    version?: string;
    correlationId?: string;
  };
}

export interface ISubscriptionFilter<T = any> {
  (payload: ISubscriptionPayload<T>, variables: Record<string, any>, context: any): boolean;
}

export interface ISubscriptionResolver<T = any> {
  subscribe: ISubscriptionIterator<T>;
  resolve?: (payload: ISubscriptionPayload<T>) => T;
  filter?: ISubscriptionFilter<T>;
}

export interface ISubscriptionIterator<T = any> {
  (
    parent: any,
    args: Record<string, any>,
    context: any,
    info: GraphQLResolveInfo
  ): AsyncIterator<ISubscriptionPayload<T>> | Promise<AsyncIterator<ISubscriptionPayload<T>>>;
}

export interface ISubscriptionOptions {
  bufferSize?: number;
  keepAlive?: boolean;
  keepAliveInterval?: number;
  connectionTimeout?: number;
  maxConnections?: number;
  enableCompression?: boolean;
  enableBatching?: boolean;
}

export interface ISubscriptionConnection {
  id: string;
  userId?: string;
  startTime: Date;
  lastActivity: Date;
  subscriptions: Set<string>;
  metadata: Record<string, any>;
  isActive: boolean;
}

export interface ISubscriptionManager {
  /**
   * Create a new subscription
   */
  subscribe<T>(
    name: string,
    resolver: ISubscriptionResolver<T>,
    options?: ISubscriptionOptions
  ): Promise<string>;

  /**
   * Unsubscribe from a subscription
   */
  unsubscribe(subscriptionId: string): Promise<boolean>;

  /**
   * Publish data to all subscribers of a topic
   */
  publish<T>(topic: string, payload: ISubscriptionPayload<T>): Promise<number>;

  /**
   * Publish to specific subscribers based on filter
   */
  publishToSubscribers<T>(
    topic: string,
    payload: ISubscriptionPayload<T>,
    filter: ISubscriptionFilter<T>
  ): Promise<number>;

  /**
   * Get active connections
   */
  getConnections(): Map<string, ISubscriptionConnection>;

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): ISubscriptionConnection | undefined;

  /**
   * Close a connection
   */
  closeConnection(connectionId: string): Promise<boolean>;

  /**
   * Get subscription statistics
   */
  getStats(): ISubscriptionStats;

  /**
   * Check connection health
   */
  healthCheck(): Promise<ISubscriptionHealth>;
}

export interface ISubscriptionStats {
  activeConnections: number;
  totalSubscriptions: number;
  messagesSent: number;
  messagesReceived: number;
  averageConnectionDuration: number;
  peakConnections: number;
  errorRate: number;
  uptime: number;
}

export interface ISubscriptionHealth {
  healthy: boolean;
  connections: number;
  memoryUsage: number;
  latency: number;
  errors: string[];
  warnings: string[];
}

export interface IWebSocketManager {
  /**
   * Handle new WebSocket connection
   */
  handleConnection(request: FastifyRequest, socket: WebSocket): Promise<void>;

  /**
   * Handle WebSocket message
   */
  handleMessage(connectionId: string, message: string): Promise<void>;

  /**
   * Handle WebSocket disconnection
   */
  handleDisconnection(connectionId: string): Promise<void>;

  /**
   * Send message to connection
   */
  sendMessage(connectionId: string, message: any): Promise<boolean>;

  /**
   * Broadcast message to all connections
   */
  broadcast(message: any, filter?: (connection: ISubscriptionConnection) => boolean): Promise<number>;

  /**
   * Get connection by WebSocket
   */
  getConnectionBySocket(socket: WebSocket): ISubscriptionConnection | undefined;
}

export interface ISubscriptionMiddleware {
  /**
   * Execute before subscription starts
   */
  beforeSubscribe?(
    name: string,
    variables: Record<string, any>,
    context: any
  ): Promise<void>;

  /**
   * Execute after subscription starts
   */
  afterSubscribe?(
    subscriptionId: string,
    name: string,
    context: any
  ): Promise<void>;

  /**
   * Execute before publishing
   */
  beforePublish?<T>(
    topic: string,
    payload: ISubscriptionPayload<T>
  ): Promise<ISubscriptionPayload<T>>;

  /**
   * Execute after publishing
   */
  afterPublish?<T>(
    topic: string,
    payload: ISubscriptionPayload<T>,
    subscriberCount: number
  ): Promise<void>;

  /**
   * Execute on subscription error
   */
  onError?(
    error: Error,
    subscriptionId?: string,
    context?: any
  ): Promise<void>;
}

export interface ISubscriptionAuth {
  /**
   * Authenticate subscription request
   */
  authenticate(
    request: FastifyRequest,
    subscriptionName: string,
    variables: Record<string, any>
  ): Promise<boolean>;

  /**
   * Authorize subscription for user
   */
  authorize(
    userId: string,
    subscriptionName: string,
    variables: Record<string, any>
  ): Promise<boolean>;

  /**
   * Get user context from request
   */
  getUserContext(request: FastifyRequest): Promise<any>;
}