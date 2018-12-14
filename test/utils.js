/* eslint-env mocha */
/* global MasqCommon */
/* global chai */

describe('MasqCommon utils', function () {
  context('Generating a random buffer (e.g. iv)', () => {
    it('Should generate a random buffer without length parameter', () => {
      const iv1 = MasqCommon.utils.genRandomBuffer()
      chai.assert.lengthOf(iv1, 16, 'Default length is 16')
    })
    it('Should generate a random buffer with a specific length parameter', () => {
      const iv2 = MasqCommon.utils.genRandomBuffer(8)
      chai.assert.lengthOf(iv2, 8, 'Array length is not 8')
    })
  })
  context('Should derive and hash a passphrase ', () => {
    let passphrase = 'mySecretPass'
    it('Should derive a passphrase [string] with default settings', async () => {
      const hashedPassphrase = await MasqCommon.utils.derivePassphrase(passphrase)
      chai.assert.equal(hashedPassphrase.hashAlgo, 'SHA-256', 'Default hash algo is SHA-256')
      chai.assert.equal(hashedPassphrase.iterations, 100000, 'Default iteration is 100000')
      chai.assert.lengthOf(hashedPassphrase.storedHash, 64, 'SHA-256 returns a 256 bits array, 64 bytes as hex string')
      chai.assert.lengthOf(hashedPassphrase.salt, 32, 'Default salt is 128 bits array, 32 bytes as hex string')
    })
    it('Should reject if passphrase is not a string or is empty', async () => {
      let err = '_ERROR_NOT_THROWN_'
      try {
        await MasqCommon.utils.derivePassphrase([])
      } catch (error) {
        err = error.name
      }
      chai.assert.equal(err, MasqCommon.errors.ERRORS.NOPASSPHRASE, 'Reject if passphrase is not a string')
    })

    it('Should return true if the given passphrase is the same as the stored one', async () => {
      const hashedPassphrase = await MasqCommon.utils.derivePassphrase(passphrase)
      const res = await MasqCommon.utils.checkPassphrase(passphrase, hashedPassphrase)
      chai.assert.equal(res, true, 'The check operation should return true')
    })
    it('Should return false if the given passphrase is NOT the same as the stored one', async () => {
      const hashedPassphrase = await MasqCommon.utils.derivePassphrase(passphrase)
      const res = await MasqCommon.utils.checkPassphrase(passphrase + 'modifed', hashedPassphrase)
      chai.assert.equal(res, false, 'The check operation should return false')
    })
    it('Should reject if the any property of hashedPassphrase is missing or empty', async () => {
      let err = '_ERROR_NOT_THROWN_'
      try {
        await MasqCommon.utils.checkPassphrase('secretPassphraseCandidate', {})
      } catch (error) {
        err = error.name
      }
      chai.assert.equal(err, MasqCommon.errors.ERRORS.WRONGPARAMETER, 'A requried property is missing')
    })
    it('The salt and storedHash must be different for two consecutive call to derivePassphrase even with the same passphrase', async () => {
      const hashedPassphrase1 = await MasqCommon.utils.derivePassphrase(passphrase)
      const hashedPassphrase2 = await MasqCommon.utils.derivePassphrase(passphrase)
      chai.assert.equal(hashedPassphrase1.salt === hashedPassphrase2.salt, false, 'Two different salt')
      chai.assert.equal(hashedPassphrase1.storedHash === hashedPassphrase2.storedHash, false, 'Two different salt')
    })
  })
  context('AES operations and key export/import', () => {
    it('Should generate an extractable AES key cryptokey with default settings (AES-GCM 128 bits)', async () => {
      const key = await MasqCommon.utils.genAESKey()
      chai.assert.equal(key.type, 'secret', 'Secret key')
      chai.assert.equal(key.extractable, true, 'Key is extractable by default to allow export or wrap')
    })

    it('Should generate and export (in raw format by default) an extractable AES key cryptokey with default settings (AES-GCM 128 bits)', async () => {
      const key = await MasqCommon.utils.genAESKey()
      const rawKey = await MasqCommon.utils.exportKey(key)
      chai.assert.lengthOf(rawKey, 16, 'Default size is 128 bits')
    })
    it('Should generate and export (in raw format by default) an extractable AES key cryptokey with default settings (AES-GCM 256 bits)', async () => {
      const key = await MasqCommon.utils.genAESKey(true, 'AES-GCM', 256)
      const rawKey = await MasqCommon.utils.exportKey(key)
      chai.assert.lengthOf(rawKey, 32, 'Default size is 256 bits')
    })
    it('Should generate and export in raw format an extractable AES key cryptokey with default settings (AES-GCM 128 bits)', async () => {
      const key = await MasqCommon.utils.genAESKey()
      const rawKey = await MasqCommon.utils.exportKey(key, 'raw')
      chai.assert.lengthOf(rawKey, 16, 'Default size is 128 bits')
    })
    it('Should reject if the key is not a CryptoKey', async () => {
      let err = '_ERROR_NOT_THROWN_'
      try {
        await MasqCommon.utils.encrypt([2, 3], { data: 'hello' })
      } catch (error) {
        err = error.name
      }
      chai.assert.equal(err, MasqCommon.errors.ERRORS.NOCRYPTOKEY, 'Reject if given key is not a CryptoKey')
    })
    it('Should encrypt a message and encode with default format (hex)', async () => {
      const message = { data: 'hello' }
      const key = await MasqCommon.utils.genAESKey()
      const ciphertext = await MasqCommon.utils.encrypt(key, message)
      chai.assert.lengthOf(ciphertext.iv, 32, 'Default size is 32 for hex format (128 bits iv)')
    })
    it('Should encrypt a message and encode with base64 format ', async () => {
      const message = { data: 'hello' }
      const key = await MasqCommon.utils.genAESKey()
      const ciphertext = await MasqCommon.utils.encrypt(key, message, 'base64')
      chai.assert.equal(ciphertext.iv.slice(-1), '=', 'Last charachter of base64 is always =')
    })
    it('Should encrypt and decrypt a message with default parameters', async () => {
      const message = { data: 'hello' }
      const key = await MasqCommon.utils.genAESKey()
      const ciphertext = await MasqCommon.utils.encrypt(key, message)
      const plaintext = await MasqCommon.utils.decrypt(key, ciphertext)

      chai.assert.deepEqual(plaintext, message, 'Must get the initial message after decryption')
    })
    it('Should generate/encrypt/export/import/decrypt as with raw format for key export', async () => {
      const message = { data: 'hello' }
      const key = await MasqCommon.utils.genAESKey()
      const ciphertext = await MasqCommon.utils.encrypt(key, message)
      const rawKey = await MasqCommon.utils.exportKey(key)
      const cryptoKey = await MasqCommon.utils.importKey(rawKey)
      const plaintext = await MasqCommon.utils.decrypt(cryptoKey, ciphertext)

      chai.assert.deepEqual(plaintext, message, 'Must get the initial message after decryption')
    })
    it('Should generate/encrypt/export/import/decrypt as with jwk format for key export', async () => {
      const message = { data: 'hello' }
      const key = await MasqCommon.utils.genAESKey()
      const ciphertext = await MasqCommon.utils.encrypt(key, message)
      const jwkKey = await MasqCommon.utils.exportKey(key, 'jwk')
      const cryptoKey = await MasqCommon.utils.importKey(jwkKey, 'jwk')
      const plaintext = await MasqCommon.utils.decrypt(cryptoKey, ciphertext)

      chai.assert.deepEqual(plaintext, message, 'Must get the initial message after decryption')
    })
  })
})
