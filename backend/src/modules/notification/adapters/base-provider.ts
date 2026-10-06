export interface NotificationPayload {
  to: string;
  subject?: string;
  body: string;
  metadata?: Record<string, any>;
}

export interface NotificationResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface INotificationProvider {
  readonly providerName: string;
  readonly channel: string; // 'email','sms','whatsapp'
  
  send(payload: NotificationPayload, config: Record<string, any>): Promise<NotificationResult>;
  getDeliveryStatus(providerMessageId: string, config: Record<string, any>): Promise<string>;
}