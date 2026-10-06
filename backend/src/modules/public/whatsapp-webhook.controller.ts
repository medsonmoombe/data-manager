import { Controller, Post, Body, Headers, Get, Query, Res } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { WhatsAppBotService } from './whatsapp-bot.service';
import { Response } from 'express';

@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  constructor(private readonly whatsappBot: WhatsAppBotService) {}

  /**
   * WhatsApp webhook verification (required by WhatsApp API).
   */
  @Public()
  @Get()
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'omnicore_whatsapp_2026';

    if (mode === 'subscribe' && verifyToken === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }

    return res.status(403).send('Forbidden');
  }

  /**
   * Receive incoming WhatsApp messages.
   */
  @Public()
  @Post()
  async receiveMessage(@Body() body: any) {
    // WhatsApp Business API format
    try {
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const message = change?.value?.messages?.[0];

      if (!message) return { status: 'no_message' };

      const senderPhone = message.from;
      const messageText = message.text?.body || '';

      // Process and respond
      const response = await this.whatsappBot.processMessage(senderPhone, messageText);

      // In production: send response back via WhatsApp API
      // await this.whatsappProvider.send({ to: senderPhone, body: response });

      return {
        status: 'processed',
        response,
        sender: senderPhone,
      };
    } catch (error) {
      return { status: 'error', message: (error as Error).message };
    }
  }
}