import { Injectable } from '@nestjs/common';
import { INotificationProvider } from './base-provider';
import { EmailSmtpProvider } from './email-smtp.provider';
import { SmsTwilioProvider } from './sms-twilio.provider';
import { WhatsAppBaileysProvider } from './whatsapp-baileys.provider';
import { InAppProvider } from './in-app.provider';

@Injectable()
export class ProviderRegistry {
  private providers: Map<string, INotificationProvider> = new Map();

  constructor(
    private readonly emailProvider: EmailSmtpProvider,
    private readonly smsProvider: SmsTwilioProvider,
    private readonly whatsappProvider: WhatsAppBaileysProvider,
    private readonly inAppProvider: InAppProvider,
  ) {
    this.providers.set('smtp', emailProvider);
    this.providers.set('twilio', smsProvider);
    this.providers.set('baileys', whatsappProvider);
    this.providers.set('in_app', inAppProvider);
  }

  getProvider(providerName: string): INotificationProvider {
    const provider = this.providers.get(providerName);
    if (!provider) throw new Error(`Unknown provider: ${providerName}`);
    return provider;
  }

  getProvidersByChannel(channel: string): INotificationProvider[] {
    return Array.from(this.providers.values()).filter((p) => p.channel === channel);
  }
}