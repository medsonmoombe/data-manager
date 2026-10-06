import { Injectable, Logger } from '@nestjs/common';
import { INotificationProvider, NotificationPayload, NotificationResult } from './base-provider';
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';

@Injectable()
export class WhatsAppBaileysProvider implements INotificationProvider {
  readonly providerName = 'baileys';
  readonly channel = 'whatsapp';
  private readonly logger = new Logger(WhatsAppBaileysProvider.name);
  private socket: any = null;
  private isConnected = false;

  async connect(orgId: string, config: Record<string, any>) {
    const { state, saveCreds } = await useMultiFileAuthState(config.authDir || `./whatsapp-auth/${orgId}`);

    this.socket = makeWASocket({
      auth: state,
      printQRInTerminal: true,
    });

    this.socket.ev.on('creds.update', saveCreds);

    this.socket.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect } = update;
      if (connection === 'open') {
        this.isConnected = true;
        this.logger.log(`WhatsApp connected for org ${orgId}`);
      }
      if (connection === 'close') {
        this.isConnected = false;
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) {
          this.connect(orgId, config);
        }
      }
    });
  }

  async send(payload: NotificationPayload, config: Record<string, any>): Promise<NotificationResult> {
    if (!this.socket || !this.isConnected) {
      await this.connect(config.orgId, config);
      // Wait for connection
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    if (!this.isConnected) {
      return { success: false, error: 'WhatsApp not connected. Scan QR code.' };
    }

    try {
      const jid = `${payload.to.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
      
      const result = await this.socket.sendMessage(jid, {
        text: payload.body,
      });

      this.logger.log(`WhatsApp message sent to ${payload.to}`);

      return {
        success: true,
        providerMessageId: result?.key?.id || undefined,
      };
    } catch (err) {
      this.logger.error(`WhatsApp failed: ${(err as Error).message}}`);
      return { success: false, error:(err as Error).message };
    }
  }

  async getDeliveryStatus(providerMessageId: string, config: Record<string, any>): Promise<string> {
    return 'sent';
  }
}