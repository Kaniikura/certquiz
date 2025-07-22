/**
 * ID Generator Tests
 * @fileoverview Tests for ID generation abstractions and implementations
 */

import { describe, expect, it, vi } from 'vitest';
import { CryptoIdGenerator } from './CryptoIdGenerator';
import type { IdGenerator } from './IdGenerator';
import { SequentialIdGenerator } from './SequentialIdGenerator';

describe('IdGenerator Implementations', () => {
  describe('CryptoIdGenerator', () => {
    it('should implement IdGenerator interface', () => {
      const generator = new CryptoIdGenerator();
      expect(generator).toHaveProperty('generate');
      expect(typeof generator.generate).toBe('function');
    });

    it('should generate valid UUID v4 strings', () => {
      const generator = new CryptoIdGenerator();
      const id = generator.generate();

      // UUID v4 pattern: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(id).toMatch(uuidRegex);
    });

    it('should generate unique IDs on subsequent calls', () => {
      const generator = new CryptoIdGenerator();
      const ids = new Set<string>();

      // Generate 100 IDs and ensure they're all unique
      for (let i = 0; i < 100; i++) {
        const id = generator.generate();
        expect(ids.has(id)).toBe(false);
        ids.add(id);
      }

      expect(ids.size).toBe(100);
    });

    it('should throw error when crypto.randomUUID is not available', () => {
      const originalCrypto = global.crypto;

      // Mock crypto object without randomUUID
      Object.defineProperty(global, 'crypto', {
        value: {},
        writable: true,
        configurable: true,
      });

      const generator = new CryptoIdGenerator();
      expect(() => generator.generate()).toThrow('crypto.randomUUID is not available');

      // Restore original crypto
      Object.defineProperty(global, 'crypto', {
        value: originalCrypto,
        writable: true,
        configurable: true,
      });
    });

    it('should throw error when crypto.randomUUID function is not available', () => {
      const originalRandomUUID = global.crypto.randomUUID;

      // Mock crypto.randomUUID as undefined
      // @ts-expect-error - Intentionally testing error case
      global.crypto.randomUUID = undefined;

      const generator = new CryptoIdGenerator();
      expect(() => generator.generate()).toThrow('crypto.randomUUID is not available');

      // Restore original function
      global.crypto.randomUUID = originalRandomUUID;
    });
  });

  describe('SequentialIdGenerator', () => {
    it('should implement IdGenerator interface', () => {
      const generator = new SequentialIdGenerator();
      expect(generator).toHaveProperty('generate');
      expect(typeof generator.generate).toBe('function');
    });

    it('should generate sequential IDs with default prefix', () => {
      const generator = new SequentialIdGenerator();

      expect(generator.generate()).toBe('test-000001');
      expect(generator.generate()).toBe('test-000002');
      expect(generator.generate()).toBe('test-000003');
    });

    it('should generate sequential IDs with custom prefix', () => {
      const generator = new SequentialIdGenerator('question');

      expect(generator.generate()).toBe('question-000001');
      expect(generator.generate()).toBe('question-000002');
      expect(generator.generate()).toBe('question-000003');
    });

    it('should reset counter to specified value', () => {
      const generator = new SequentialIdGenerator();

      generator.generate(); // 000001
      generator.generate(); // 000002

      generator.reset(10);
      expect(generator.generate()).toBe('test-000010');
      expect(generator.generate()).toBe('test-000011');
    });

    it('should reset counter to 1 by default', () => {
      const generator = new SequentialIdGenerator();

      generator.generate(); // 000001
      generator.generate(); // 000002

      generator.reset();
      expect(generator.generate()).toBe('test-000001');
    });

    it('should return current counter value', () => {
      const generator = new SequentialIdGenerator();

      expect(generator.getCurrentCounter()).toBe(1);
      generator.generate();
      expect(generator.getCurrentCounter()).toBe(2);
      generator.generate();
      expect(generator.getCurrentCounter()).toBe(3);
    });

    it('should pad counter with leading zeros correctly', () => {
      const generator = new SequentialIdGenerator();

      // Test various counter values
      expect(generator.generate()).toBe('test-000001');

      generator.reset(99);
      expect(generator.generate()).toBe('test-000099');

      generator.reset(999);
      expect(generator.generate()).toBe('test-000999');

      generator.reset(9999);
      expect(generator.generate()).toBe('test-009999');

      generator.reset(99999);
      expect(generator.generate()).toBe('test-099999');

      generator.reset(999999);
      expect(generator.generate()).toBe('test-999999');

      generator.reset(1000000);
      expect(generator.generate()).toBe('test-1000000');
    });

    it('should be deterministic for testing', () => {
      const generator1 = new SequentialIdGenerator('test');
      const generator2 = new SequentialIdGenerator('test');

      // Both generators should produce identical sequences
      for (let i = 0; i < 10; i++) {
        expect(generator1.generate()).toBe(generator2.generate());
      }
    });
  });

  describe('Polymorphic Usage', () => {
    const testGenerator = (generator: IdGenerator, label: string) => {
      it(`${label} should work polymorphically`, () => {
        const id1 = generator.generate();
        const id2 = generator.generate();

        expect(typeof id1).toBe('string');
        expect(typeof id2).toBe('string');
        expect(id1).not.toBe(id2);
        expect(id1.length).toBeGreaterThan(0);
        expect(id2.length).toBeGreaterThan(0);
      });
    };

    testGenerator(new CryptoIdGenerator(), 'CryptoIdGenerator');
    testGenerator(new SequentialIdGenerator(), 'SequentialIdGenerator');
  });

  describe('Dependency Injection Compatibility', () => {
    it('should be compatible with dependency injection', () => {
      // Mock a simple service that depends on IdGenerator
      class TestService {
        constructor(private readonly idGenerator: IdGenerator) {}

        createItem(name: string) {
          return {
            id: this.idGenerator.generate(),
            name,
            createdAt: new Date(),
          };
        }
      }

      // Test with CryptoIdGenerator
      const cryptoService = new TestService(new CryptoIdGenerator());
      const cryptoItem = cryptoService.createItem('test');
      expect(cryptoItem.id).toMatch(/^[0-9a-f-]+$/i);
      expect(cryptoItem.name).toBe('test');

      // Test with SequentialIdGenerator
      const sequentialService = new TestService(new SequentialIdGenerator('item'));
      const sequentialItem = sequentialService.createItem('test');
      expect(sequentialItem.id).toBe('item-000001');
      expect(sequentialItem.name).toBe('test');
    });

    it('should support testing with predictable IDs', () => {
      const mockIdGenerator: IdGenerator = {
        generate: vi
          .fn()
          .mockReturnValueOnce('mock-id-1')
          .mockReturnValueOnce('mock-id-2')
          .mockReturnValueOnce('mock-id-3'),
      };

      const ids = [
        mockIdGenerator.generate(),
        mockIdGenerator.generate(),
        mockIdGenerator.generate(),
      ];

      expect(ids).toEqual(['mock-id-1', 'mock-id-2', 'mock-id-3']);
      expect(mockIdGenerator.generate).toHaveBeenCalledTimes(3);
    });
  });
});
