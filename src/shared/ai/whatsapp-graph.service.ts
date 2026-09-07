import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WhatsappGraphService {
  private readonly logger = new Logger(WhatsappGraphService.name);

  async sendText(input: {
    accessToken: string;
    phoneNumberId: string;
    toWaId: string;
    body: string;
  }): Promise<void> {
    const to = input.toWaId.replace(/\D/g, '');
    const url = `https://graph.facebook.com/v22.0/${input.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: input.body },
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      this.logger.error(`WhatsApp Graph erro ${res.status}: ${t}`);
      throw new Error(`WhatsApp send failed: ${res.status}`);
    }
  }
}
