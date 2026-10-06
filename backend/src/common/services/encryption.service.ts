import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private config: ConfigService) {
    // Use a 32-byte key from environment variable
    const keyHex = this.config.get<string>('ENCRYPTION_KEY');
    if (!keyHex || keyHex.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
    }
    this.key = Buffer.from(keyHex, 'hex');
  }

  /**
   * Encrypt a string value.
   * Returns: iv:authTag:encryptedData (all hex-encoded)
   */
  encrypt(plaintext: string): string {
    if (!plaintext) return plaintext;

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    // Store IV + auth tag + encrypted data together
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt a value encrypted with encrypt().
   */
  decrypt(ciphertext: string): string {
    if (!ciphertext || !ciphertext.includes(':')) return ciphertext;

    const [ivHex, authTagHex, encrypted] = ciphertext.split(':');

    if (!ivHex || !authTagHex || !encrypted) return ciphertext;

    try {
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      // If decryption fails (wrong key, tampered data), return raw
      return ciphertext;
    }
  }

  /**
   * Encrypt specific fields in a data object.
   */
  encryptFields(data: Record<string, any>, sensitiveFields: string[]): Record<string, any> {
    const encrypted = { ...data };
    for (const field of sensitiveFields) {
      if (encrypted[field]) {
        encrypted[field] = this.encrypt(String(encrypted[field]));
      }
    }
    return encrypted;
  }

  /**
   * Decrypt specific fields in a data object.
   */
  decryptFields(data: Record<string, any>, sensitiveFields: string[]): Record<string, any> {
    const decrypted = { ...data };
    for (const field of sensitiveFields) {
      if (decrypted[field]) {
        decrypted[field] = this.decrypt(String(decrypted[field]));
      }
    }
    return decrypted;
  }
}