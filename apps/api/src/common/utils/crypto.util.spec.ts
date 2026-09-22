import { randomBytes } from 'node:crypto';
import { decryptSecret, encryptSecret } from './crypto.util';

describe('crypto.util', () => {
  const key = randomBytes(32).toString('hex');

  it('encrypts and decrypts a round trip correctly', () => {
    const plaintext = 'IGAAxxxxxxxx-very-secret-access-token';
    const encrypted = encryptSecret(plaintext, key);

    expect(encrypted).not.toEqual(plaintext);
    expect(decryptSecret(encrypted, key)).toEqual(plaintext);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const plaintext = 'same-input';
    const a = encryptSecret(plaintext, key);
    const b = encryptSecret(plaintext, key);

    expect(a).not.toEqual(b);
  });

  it('throws when the payload has been tampered with', () => {
    const encrypted = encryptSecret('secret', key);
    const [iv, authTag, ciphertext] = encrypted.split(':');
    const tampered = `${iv}:${authTag}:${ciphertext.slice(0, -2)}00`;

    expect(() => decryptSecret(tampered, key)).toThrow();
  });

  it('throws on a malformed payload', () => {
    expect(() => decryptSecret('not-a-valid-payload', key)).toThrow(
      'Malformed encrypted secret payload',
    );
  });
});
