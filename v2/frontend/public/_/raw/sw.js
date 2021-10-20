(function () {
    'use strict';

    class UnsupportedValueError extends Error {
        constructor(msg, value) {
            super(`${msg}: ${value}`);
        }
    }

    // tslint:disable:no-bitwise
    const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
    // Build a lookup table for decoding.
    const lookupTable = Object.create(null);
    for (let i = 0; i < alphabet.length; i++) {
        lookupTable[alphabet[i]] = i;
    }
    // Add aliases for rfc4648.
    lookupTable['0'] = lookupTable.o;
    lookupTable['1'] = lookupTable.i;

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function getDefaultExportFromCjs (x) {
    	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
    }

    function createCommonjsModule(fn) {
      var module = { exports: {} };
    	return fn(module, module.exports), module.exports;
    }

    /**
     * [js-sha256]{@link https://github.com/emn178/js-sha256}
     *
     * @version 0.9.0
     * @author Chen, Yi-Cyuan [emn178@gmail.com]
     * @copyright Chen, Yi-Cyuan 2014-2017
     * @license MIT
     */

    createCommonjsModule(function (module) {
    /*jslint bitwise: true */
    (function () {

      var ERROR = 'input is invalid type';
      var WINDOW = typeof window === 'object';
      var root = WINDOW ? window : {};
      if (root.JS_SHA256_NO_WINDOW) {
        WINDOW = false;
      }
      var WEB_WORKER = !WINDOW && typeof self === 'object';
      var NODE_JS = !root.JS_SHA256_NO_NODE_JS && typeof process === 'object' && process.versions && process.versions.node;
      if (NODE_JS) {
        root = commonjsGlobal;
      } else if (WEB_WORKER) {
        root = self;
      }
      var COMMON_JS = !root.JS_SHA256_NO_COMMON_JS && 'object' === 'object' && module.exports;
      var ARRAY_BUFFER = !root.JS_SHA256_NO_ARRAY_BUFFER && typeof ArrayBuffer !== 'undefined';
      var HEX_CHARS = '0123456789abcdef'.split('');
      var EXTRA = [-2147483648, 8388608, 32768, 128];
      var SHIFT = [24, 16, 8, 0];
      var K = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
      ];
      var OUTPUT_TYPES = ['hex', 'array', 'digest', 'arrayBuffer'];

      var blocks = [];

      if (root.JS_SHA256_NO_NODE_JS || !Array.isArray) {
        Array.isArray = function (obj) {
          return Object.prototype.toString.call(obj) === '[object Array]';
        };
      }

      if (ARRAY_BUFFER && (root.JS_SHA256_NO_ARRAY_BUFFER_IS_VIEW || !ArrayBuffer.isView)) {
        ArrayBuffer.isView = function (obj) {
          return typeof obj === 'object' && obj.buffer && obj.buffer.constructor === ArrayBuffer;
        };
      }

      var createOutputMethod = function (outputType, is224) {
        return function (message) {
          return new Sha256(is224, true).update(message)[outputType]();
        };
      };

      var createMethod = function (is224) {
        var method = createOutputMethod('hex', is224);
        if (NODE_JS) {
          method = nodeWrap(method, is224);
        }
        method.create = function () {
          return new Sha256(is224);
        };
        method.update = function (message) {
          return method.create().update(message);
        };
        for (var i = 0; i < OUTPUT_TYPES.length; ++i) {
          var type = OUTPUT_TYPES[i];
          method[type] = createOutputMethod(type, is224);
        }
        return method;
      };

      var nodeWrap = function (method, is224) {
        var crypto = eval("require('crypto')");
        var Buffer = eval("require('buffer').Buffer");
        var algorithm = is224 ? 'sha224' : 'sha256';
        var nodeMethod = function (message) {
          if (typeof message === 'string') {
            return crypto.createHash(algorithm).update(message, 'utf8').digest('hex');
          } else {
            if (message === null || message === undefined) {
              throw new Error(ERROR);
            } else if (message.constructor === ArrayBuffer) {
              message = new Uint8Array(message);
            }
          }
          if (Array.isArray(message) || ArrayBuffer.isView(message) ||
            message.constructor === Buffer) {
            return crypto.createHash(algorithm).update(new Buffer(message)).digest('hex');
          } else {
            return method(message);
          }
        };
        return nodeMethod;
      };

      var createHmacOutputMethod = function (outputType, is224) {
        return function (key, message) {
          return new HmacSha256(key, is224, true).update(message)[outputType]();
        };
      };

      var createHmacMethod = function (is224) {
        var method = createHmacOutputMethod('hex', is224);
        method.create = function (key) {
          return new HmacSha256(key, is224);
        };
        method.update = function (key, message) {
          return method.create(key).update(message);
        };
        for (var i = 0; i < OUTPUT_TYPES.length; ++i) {
          var type = OUTPUT_TYPES[i];
          method[type] = createHmacOutputMethod(type, is224);
        }
        return method;
      };

      function Sha256(is224, sharedMemory) {
        if (sharedMemory) {
          blocks[0] = blocks[16] = blocks[1] = blocks[2] = blocks[3] =
            blocks[4] = blocks[5] = blocks[6] = blocks[7] =
            blocks[8] = blocks[9] = blocks[10] = blocks[11] =
            blocks[12] = blocks[13] = blocks[14] = blocks[15] = 0;
          this.blocks = blocks;
        } else {
          this.blocks = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        }

        if (is224) {
          this.h0 = 0xc1059ed8;
          this.h1 = 0x367cd507;
          this.h2 = 0x3070dd17;
          this.h3 = 0xf70e5939;
          this.h4 = 0xffc00b31;
          this.h5 = 0x68581511;
          this.h6 = 0x64f98fa7;
          this.h7 = 0xbefa4fa4;
        } else { // 256
          this.h0 = 0x6a09e667;
          this.h1 = 0xbb67ae85;
          this.h2 = 0x3c6ef372;
          this.h3 = 0xa54ff53a;
          this.h4 = 0x510e527f;
          this.h5 = 0x9b05688c;
          this.h6 = 0x1f83d9ab;
          this.h7 = 0x5be0cd19;
        }

        this.block = this.start = this.bytes = this.hBytes = 0;
        this.finalized = this.hashed = false;
        this.first = true;
        this.is224 = is224;
      }

      Sha256.prototype.update = function (message) {
        if (this.finalized) {
          return;
        }
        var notString, type = typeof message;
        if (type !== 'string') {
          if (type === 'object') {
            if (message === null) {
              throw new Error(ERROR);
            } else if (ARRAY_BUFFER && message.constructor === ArrayBuffer) {
              message = new Uint8Array(message);
            } else if (!Array.isArray(message)) {
              if (!ARRAY_BUFFER || !ArrayBuffer.isView(message)) {
                throw new Error(ERROR);
              }
            }
          } else {
            throw new Error(ERROR);
          }
          notString = true;
        }
        var code, index = 0, i, length = message.length, blocks = this.blocks;

        while (index < length) {
          if (this.hashed) {
            this.hashed = false;
            blocks[0] = this.block;
            blocks[16] = blocks[1] = blocks[2] = blocks[3] =
              blocks[4] = blocks[5] = blocks[6] = blocks[7] =
              blocks[8] = blocks[9] = blocks[10] = blocks[11] =
              blocks[12] = blocks[13] = blocks[14] = blocks[15] = 0;
          }

          if (notString) {
            for (i = this.start; index < length && i < 64; ++index) {
              blocks[i >> 2] |= message[index] << SHIFT[i++ & 3];
            }
          } else {
            for (i = this.start; index < length && i < 64; ++index) {
              code = message.charCodeAt(index);
              if (code < 0x80) {
                blocks[i >> 2] |= code << SHIFT[i++ & 3];
              } else if (code < 0x800) {
                blocks[i >> 2] |= (0xc0 | (code >> 6)) << SHIFT[i++ & 3];
                blocks[i >> 2] |= (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
              } else if (code < 0xd800 || code >= 0xe000) {
                blocks[i >> 2] |= (0xe0 | (code >> 12)) << SHIFT[i++ & 3];
                blocks[i >> 2] |= (0x80 | ((code >> 6) & 0x3f)) << SHIFT[i++ & 3];
                blocks[i >> 2] |= (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
              } else {
                code = 0x10000 + (((code & 0x3ff) << 10) | (message.charCodeAt(++index) & 0x3ff));
                blocks[i >> 2] |= (0xf0 | (code >> 18)) << SHIFT[i++ & 3];
                blocks[i >> 2] |= (0x80 | ((code >> 12) & 0x3f)) << SHIFT[i++ & 3];
                blocks[i >> 2] |= (0x80 | ((code >> 6) & 0x3f)) << SHIFT[i++ & 3];
                blocks[i >> 2] |= (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
              }
            }
          }

          this.lastByteIndex = i;
          this.bytes += i - this.start;
          if (i >= 64) {
            this.block = blocks[16];
            this.start = i - 64;
            this.hash();
            this.hashed = true;
          } else {
            this.start = i;
          }
        }
        if (this.bytes > 4294967295) {
          this.hBytes += this.bytes / 4294967296 << 0;
          this.bytes = this.bytes % 4294967296;
        }
        return this;
      };

      Sha256.prototype.finalize = function () {
        if (this.finalized) {
          return;
        }
        this.finalized = true;
        var blocks = this.blocks, i = this.lastByteIndex;
        blocks[16] = this.block;
        blocks[i >> 2] |= EXTRA[i & 3];
        this.block = blocks[16];
        if (i >= 56) {
          if (!this.hashed) {
            this.hash();
          }
          blocks[0] = this.block;
          blocks[16] = blocks[1] = blocks[2] = blocks[3] =
            blocks[4] = blocks[5] = blocks[6] = blocks[7] =
            blocks[8] = blocks[9] = blocks[10] = blocks[11] =
            blocks[12] = blocks[13] = blocks[14] = blocks[15] = 0;
        }
        blocks[14] = this.hBytes << 3 | this.bytes >>> 29;
        blocks[15] = this.bytes << 3;
        this.hash();
      };

      Sha256.prototype.hash = function () {
        var a = this.h0, b = this.h1, c = this.h2, d = this.h3, e = this.h4, f = this.h5, g = this.h6,
          h = this.h7, blocks = this.blocks, j, s0, s1, maj, t1, t2, ch, ab, da, cd, bc;

        for (j = 16; j < 64; ++j) {
          // rightrotate
          t1 = blocks[j - 15];
          s0 = ((t1 >>> 7) | (t1 << 25)) ^ ((t1 >>> 18) | (t1 << 14)) ^ (t1 >>> 3);
          t1 = blocks[j - 2];
          s1 = ((t1 >>> 17) | (t1 << 15)) ^ ((t1 >>> 19) | (t1 << 13)) ^ (t1 >>> 10);
          blocks[j] = blocks[j - 16] + s0 + blocks[j - 7] + s1 << 0;
        }

        bc = b & c;
        for (j = 0; j < 64; j += 4) {
          if (this.first) {
            if (this.is224) {
              ab = 300032;
              t1 = blocks[0] - 1413257819;
              h = t1 - 150054599 << 0;
              d = t1 + 24177077 << 0;
            } else {
              ab = 704751109;
              t1 = blocks[0] - 210244248;
              h = t1 - 1521486534 << 0;
              d = t1 + 143694565 << 0;
            }
            this.first = false;
          } else {
            s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
            s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
            ab = a & b;
            maj = ab ^ (a & c) ^ bc;
            ch = (e & f) ^ (~e & g);
            t1 = h + s1 + ch + K[j] + blocks[j];
            t2 = s0 + maj;
            h = d + t1 << 0;
            d = t1 + t2 << 0;
          }
          s0 = ((d >>> 2) | (d << 30)) ^ ((d >>> 13) | (d << 19)) ^ ((d >>> 22) | (d << 10));
          s1 = ((h >>> 6) | (h << 26)) ^ ((h >>> 11) | (h << 21)) ^ ((h >>> 25) | (h << 7));
          da = d & a;
          maj = da ^ (d & b) ^ ab;
          ch = (h & e) ^ (~h & f);
          t1 = g + s1 + ch + K[j + 1] + blocks[j + 1];
          t2 = s0 + maj;
          g = c + t1 << 0;
          c = t1 + t2 << 0;
          s0 = ((c >>> 2) | (c << 30)) ^ ((c >>> 13) | (c << 19)) ^ ((c >>> 22) | (c << 10));
          s1 = ((g >>> 6) | (g << 26)) ^ ((g >>> 11) | (g << 21)) ^ ((g >>> 25) | (g << 7));
          cd = c & d;
          maj = cd ^ (c & a) ^ da;
          ch = (g & h) ^ (~g & e);
          t1 = f + s1 + ch + K[j + 2] + blocks[j + 2];
          t2 = s0 + maj;
          f = b + t1 << 0;
          b = t1 + t2 << 0;
          s0 = ((b >>> 2) | (b << 30)) ^ ((b >>> 13) | (b << 19)) ^ ((b >>> 22) | (b << 10));
          s1 = ((f >>> 6) | (f << 26)) ^ ((f >>> 11) | (f << 21)) ^ ((f >>> 25) | (f << 7));
          bc = b & c;
          maj = bc ^ (b & d) ^ cd;
          ch = (f & g) ^ (~f & h);
          t1 = e + s1 + ch + K[j + 3] + blocks[j + 3];
          t2 = s0 + maj;
          e = a + t1 << 0;
          a = t1 + t2 << 0;
        }

        this.h0 = this.h0 + a << 0;
        this.h1 = this.h1 + b << 0;
        this.h2 = this.h2 + c << 0;
        this.h3 = this.h3 + d << 0;
        this.h4 = this.h4 + e << 0;
        this.h5 = this.h5 + f << 0;
        this.h6 = this.h6 + g << 0;
        this.h7 = this.h7 + h << 0;
      };

      Sha256.prototype.hex = function () {
        this.finalize();

        var h0 = this.h0, h1 = this.h1, h2 = this.h2, h3 = this.h3, h4 = this.h4, h5 = this.h5,
          h6 = this.h6, h7 = this.h7;

        var hex = HEX_CHARS[(h0 >> 28) & 0x0F] + HEX_CHARS[(h0 >> 24) & 0x0F] +
          HEX_CHARS[(h0 >> 20) & 0x0F] + HEX_CHARS[(h0 >> 16) & 0x0F] +
          HEX_CHARS[(h0 >> 12) & 0x0F] + HEX_CHARS[(h0 >> 8) & 0x0F] +
          HEX_CHARS[(h0 >> 4) & 0x0F] + HEX_CHARS[h0 & 0x0F] +
          HEX_CHARS[(h1 >> 28) & 0x0F] + HEX_CHARS[(h1 >> 24) & 0x0F] +
          HEX_CHARS[(h1 >> 20) & 0x0F] + HEX_CHARS[(h1 >> 16) & 0x0F] +
          HEX_CHARS[(h1 >> 12) & 0x0F] + HEX_CHARS[(h1 >> 8) & 0x0F] +
          HEX_CHARS[(h1 >> 4) & 0x0F] + HEX_CHARS[h1 & 0x0F] +
          HEX_CHARS[(h2 >> 28) & 0x0F] + HEX_CHARS[(h2 >> 24) & 0x0F] +
          HEX_CHARS[(h2 >> 20) & 0x0F] + HEX_CHARS[(h2 >> 16) & 0x0F] +
          HEX_CHARS[(h2 >> 12) & 0x0F] + HEX_CHARS[(h2 >> 8) & 0x0F] +
          HEX_CHARS[(h2 >> 4) & 0x0F] + HEX_CHARS[h2 & 0x0F] +
          HEX_CHARS[(h3 >> 28) & 0x0F] + HEX_CHARS[(h3 >> 24) & 0x0F] +
          HEX_CHARS[(h3 >> 20) & 0x0F] + HEX_CHARS[(h3 >> 16) & 0x0F] +
          HEX_CHARS[(h3 >> 12) & 0x0F] + HEX_CHARS[(h3 >> 8) & 0x0F] +
          HEX_CHARS[(h3 >> 4) & 0x0F] + HEX_CHARS[h3 & 0x0F] +
          HEX_CHARS[(h4 >> 28) & 0x0F] + HEX_CHARS[(h4 >> 24) & 0x0F] +
          HEX_CHARS[(h4 >> 20) & 0x0F] + HEX_CHARS[(h4 >> 16) & 0x0F] +
          HEX_CHARS[(h4 >> 12) & 0x0F] + HEX_CHARS[(h4 >> 8) & 0x0F] +
          HEX_CHARS[(h4 >> 4) & 0x0F] + HEX_CHARS[h4 & 0x0F] +
          HEX_CHARS[(h5 >> 28) & 0x0F] + HEX_CHARS[(h5 >> 24) & 0x0F] +
          HEX_CHARS[(h5 >> 20) & 0x0F] + HEX_CHARS[(h5 >> 16) & 0x0F] +
          HEX_CHARS[(h5 >> 12) & 0x0F] + HEX_CHARS[(h5 >> 8) & 0x0F] +
          HEX_CHARS[(h5 >> 4) & 0x0F] + HEX_CHARS[h5 & 0x0F] +
          HEX_CHARS[(h6 >> 28) & 0x0F] + HEX_CHARS[(h6 >> 24) & 0x0F] +
          HEX_CHARS[(h6 >> 20) & 0x0F] + HEX_CHARS[(h6 >> 16) & 0x0F] +
          HEX_CHARS[(h6 >> 12) & 0x0F] + HEX_CHARS[(h6 >> 8) & 0x0F] +
          HEX_CHARS[(h6 >> 4) & 0x0F] + HEX_CHARS[h6 & 0x0F];
        if (!this.is224) {
          hex += HEX_CHARS[(h7 >> 28) & 0x0F] + HEX_CHARS[(h7 >> 24) & 0x0F] +
            HEX_CHARS[(h7 >> 20) & 0x0F] + HEX_CHARS[(h7 >> 16) & 0x0F] +
            HEX_CHARS[(h7 >> 12) & 0x0F] + HEX_CHARS[(h7 >> 8) & 0x0F] +
            HEX_CHARS[(h7 >> 4) & 0x0F] + HEX_CHARS[h7 & 0x0F];
        }
        return hex;
      };

      Sha256.prototype.toString = Sha256.prototype.hex;

      Sha256.prototype.digest = function () {
        this.finalize();

        var h0 = this.h0, h1 = this.h1, h2 = this.h2, h3 = this.h3, h4 = this.h4, h5 = this.h5,
          h6 = this.h6, h7 = this.h7;

        var arr = [
          (h0 >> 24) & 0xFF, (h0 >> 16) & 0xFF, (h0 >> 8) & 0xFF, h0 & 0xFF,
          (h1 >> 24) & 0xFF, (h1 >> 16) & 0xFF, (h1 >> 8) & 0xFF, h1 & 0xFF,
          (h2 >> 24) & 0xFF, (h2 >> 16) & 0xFF, (h2 >> 8) & 0xFF, h2 & 0xFF,
          (h3 >> 24) & 0xFF, (h3 >> 16) & 0xFF, (h3 >> 8) & 0xFF, h3 & 0xFF,
          (h4 >> 24) & 0xFF, (h4 >> 16) & 0xFF, (h4 >> 8) & 0xFF, h4 & 0xFF,
          (h5 >> 24) & 0xFF, (h5 >> 16) & 0xFF, (h5 >> 8) & 0xFF, h5 & 0xFF,
          (h6 >> 24) & 0xFF, (h6 >> 16) & 0xFF, (h6 >> 8) & 0xFF, h6 & 0xFF
        ];
        if (!this.is224) {
          arr.push((h7 >> 24) & 0xFF, (h7 >> 16) & 0xFF, (h7 >> 8) & 0xFF, h7 & 0xFF);
        }
        return arr;
      };

      Sha256.prototype.array = Sha256.prototype.digest;

      Sha256.prototype.arrayBuffer = function () {
        this.finalize();

        var buffer = new ArrayBuffer(this.is224 ? 28 : 32);
        var dataView = new DataView(buffer);
        dataView.setUint32(0, this.h0);
        dataView.setUint32(4, this.h1);
        dataView.setUint32(8, this.h2);
        dataView.setUint32(12, this.h3);
        dataView.setUint32(16, this.h4);
        dataView.setUint32(20, this.h5);
        dataView.setUint32(24, this.h6);
        if (!this.is224) {
          dataView.setUint32(28, this.h7);
        }
        return buffer;
      };

      function HmacSha256(key, is224, sharedMemory) {
        var i, type = typeof key;
        if (type === 'string') {
          var bytes = [], length = key.length, index = 0, code;
          for (i = 0; i < length; ++i) {
            code = key.charCodeAt(i);
            if (code < 0x80) {
              bytes[index++] = code;
            } else if (code < 0x800) {
              bytes[index++] = (0xc0 | (code >> 6));
              bytes[index++] = (0x80 | (code & 0x3f));
            } else if (code < 0xd800 || code >= 0xe000) {
              bytes[index++] = (0xe0 | (code >> 12));
              bytes[index++] = (0x80 | ((code >> 6) & 0x3f));
              bytes[index++] = (0x80 | (code & 0x3f));
            } else {
              code = 0x10000 + (((code & 0x3ff) << 10) | (key.charCodeAt(++i) & 0x3ff));
              bytes[index++] = (0xf0 | (code >> 18));
              bytes[index++] = (0x80 | ((code >> 12) & 0x3f));
              bytes[index++] = (0x80 | ((code >> 6) & 0x3f));
              bytes[index++] = (0x80 | (code & 0x3f));
            }
          }
          key = bytes;
        } else {
          if (type === 'object') {
            if (key === null) {
              throw new Error(ERROR);
            } else if (ARRAY_BUFFER && key.constructor === ArrayBuffer) {
              key = new Uint8Array(key);
            } else if (!Array.isArray(key)) {
              if (!ARRAY_BUFFER || !ArrayBuffer.isView(key)) {
                throw new Error(ERROR);
              }
            }
          } else {
            throw new Error(ERROR);
          }
        }

        if (key.length > 64) {
          key = (new Sha256(is224, true)).update(key).array();
        }

        var oKeyPad = [], iKeyPad = [];
        for (i = 0; i < 64; ++i) {
          var b = key[i] || 0;
          oKeyPad[i] = 0x5c ^ b;
          iKeyPad[i] = 0x36 ^ b;
        }

        Sha256.call(this, is224, sharedMemory);

        this.update(iKeyPad);
        this.oKeyPad = oKeyPad;
        this.inner = true;
        this.sharedMemory = sharedMemory;
      }
      HmacSha256.prototype = new Sha256();

      HmacSha256.prototype.finalize = function () {
        Sha256.prototype.finalize.call(this);
        if (this.inner) {
          this.inner = false;
          var innerHash = this.array();
          Sha256.call(this, this.is224, this.sharedMemory);
          this.update(this.oKeyPad);
          this.update(innerHash);
          Sha256.prototype.finalize.call(this);
        }
      };

      var exports = createMethod();
      exports.sha256 = exports;
      exports.sha224 = createMethod(true);
      exports.sha256.hmac = createHmacMethod();
      exports.sha224.hmac = createHmacMethod(true);

      if (COMMON_JS) {
        module.exports = exports;
      } else {
        root.sha256 = exports.sha256;
        root.sha224 = exports.sha224;
      }
    })();
    });

    // takes a type of the form [] | [A] and a mapper from A -> B and returns a B or undefined
    function optional(candid, mapper) {
        if (candid === []) {
            return undefined;
        }
        return candid[0] !== undefined ? mapper(candid[0]) : undefined;
    }
    function identity(x) {
        return x;
    }

    function message(candid) {
        return {
            kind: "message",
            content: messageContent(candid.content),
            sender: candid.sender.toString(),
            repliesTo: optional(candid.replies_to, replyContext),
            messageId: candid.message_id,
            messageIndex: candid.message_index,
            reactions: reactions(candid.reactions),
            edited: candid.edited,
        };
    }
    function messageContent(candid) {
        if ("File" in candid) {
            return fileContent(candid.File);
        }
        if ("Text" in candid) {
            return textContent(candid.Text);
        }
        if ("Image" in candid) {
            return imageContent(candid.Image);
        }
        if ("Video" in candid) {
            return videoContent(candid.Video);
        }
        if ("Audio" in candid) {
            return audioContent(candid.Audio);
        }
        if ("Deleted" in candid) {
            return deletedContent(candid.Deleted);
        }
        if ("Cycles" in candid) {
            return cyclesContent(candid.Cycles);
        }
        throw new UnsupportedValueError("Unexpected ApiMessageContent type received", candid);
    }
    function deletedContent(candid) {
        return {
            kind: "deleted_content",
            deletedBy: candid.deleted_by.toString(),
            timestamp: candid.timestamp,
        };
    }
    function cyclesContent(candid) {
        return {
            kind: "cycles_content",
            caption: optional(candid.caption, identity),
            amount: candid.amount,
        };
    }
    function imageContent(candid) {
        return {
            kind: "image_content",
            height: candid.height,
            mimeType: candid.mime_type,
            blobReference: optional(candid.blob_reference, blobReference),
            thumbnailData: candid.thumbnail_data,
            caption: optional(candid.caption, identity),
            width: candid.width,
        };
    }
    function videoContent(candid) {
        return {
            kind: "video_content",
            height: candid.height,
            mimeType: candid.mime_type,
            videoData: {
                blobReference: optional(candid.video_blob_reference, blobReference),
            },
            imageData: {
                blobReference: optional(candid.image_blob_reference, blobReference),
            },
            thumbnailData: candid.thumbnail_data,
            caption: optional(candid.caption, identity),
            width: candid.width,
        };
    }
    function audioContent(candid) {
        return {
            kind: "audio_content",
            mimeType: candid.mime_type,
            blobReference: optional(candid.blob_reference, blobReference),
            caption: optional(candid.caption, identity),
        };
    }
    function textContent(candid) {
        return {
            kind: "text_content",
            text: candid.text,
        };
    }
    function fileContent(candid) {
        return {
            kind: "file_content",
            name: candid.name,
            mimeType: candid.mime_type,
            blobReference: optional(candid.blob_reference, blobReference),
            caption: optional(candid.caption, identity),
            fileSize: candid.file_size,
        };
    }
    function blobReference(candid) {
        return {
            blobId: candid.blob_id,
            canisterId: candid.canister_id.toString(),
        };
    }
    function replyContext(candid) {
        return {
            kind: "raw_reply_context",
            eventIndex: candid.event_index,
            chatIdIfOther: optional(candid.chat_id_if_other, (id) => id.toString()),
        };
    }
    function reactions(candid) {
        return candid.map(([reaction, userIds]) => ({
            reaction,
            userIds: new Set(userIds.map((u) => u.toString())),
        }));
    }

    function notification(candid) {
        if ("GroupMessageNotification" in candid) {
            return groupNotification(candid.GroupMessageNotification);
        }
        if ("DirectMessageNotification" in candid) {
            return directNotification(candid.DirectMessageNotification);
        }
        throw new Error(`Unexpected ApiNotification type received, ${candid}`);
    }
    function groupNotification(candid) {
        return {
            kind: "group_notification",
            sender: candid.sender.toString(),
            message: message(candid.message),
            senderName: candid.sender_name,
            chatId: candid.chat_id.toString(),
            groupName: candid.group_name,
        };
    }
    function directNotification(candid) {
        return {
            kind: "direct_notification",
            sender: candid.sender.toString(),
            message: message(candid.message),
            senderName: candid.sender_name,
        };
    }

    const instanceOfAny = (object, constructors) => constructors.some((c) => object instanceof c);

    let idbProxyableTypes;
    let cursorAdvanceMethods;
    // This is a function to prevent it throwing up in node environments.
    function getIdbProxyableTypes() {
        return (idbProxyableTypes ||
            (idbProxyableTypes = [
                IDBDatabase,
                IDBObjectStore,
                IDBIndex,
                IDBCursor,
                IDBTransaction,
            ]));
    }
    // This is a function to prevent it throwing up in node environments.
    function getCursorAdvanceMethods() {
        return (cursorAdvanceMethods ||
            (cursorAdvanceMethods = [
                IDBCursor.prototype.advance,
                IDBCursor.prototype.continue,
                IDBCursor.prototype.continuePrimaryKey,
            ]));
    }
    const cursorRequestMap = new WeakMap();
    const transactionDoneMap = new WeakMap();
    const transactionStoreNamesMap = new WeakMap();
    const transformCache = new WeakMap();
    const reverseTransformCache = new WeakMap();
    function promisifyRequest(request) {
        const promise = new Promise((resolve, reject) => {
            const unlisten = () => {
                request.removeEventListener('success', success);
                request.removeEventListener('error', error);
            };
            const success = () => {
                resolve(wrap(request.result));
                unlisten();
            };
            const error = () => {
                reject(request.error);
                unlisten();
            };
            request.addEventListener('success', success);
            request.addEventListener('error', error);
        });
        promise
            .then((value) => {
            // Since cursoring reuses the IDBRequest (*sigh*), we cache it for later retrieval
            // (see wrapFunction).
            if (value instanceof IDBCursor) {
                cursorRequestMap.set(value, request);
            }
            // Catching to avoid "Uncaught Promise exceptions"
        })
            .catch(() => { });
        // This mapping exists in reverseTransformCache but doesn't doesn't exist in transformCache. This
        // is because we create many promises from a single IDBRequest.
        reverseTransformCache.set(promise, request);
        return promise;
    }
    function cacheDonePromiseForTransaction(tx) {
        // Early bail if we've already created a done promise for this transaction.
        if (transactionDoneMap.has(tx))
            return;
        const done = new Promise((resolve, reject) => {
            const unlisten = () => {
                tx.removeEventListener('complete', complete);
                tx.removeEventListener('error', error);
                tx.removeEventListener('abort', error);
            };
            const complete = () => {
                resolve();
                unlisten();
            };
            const error = () => {
                reject(tx.error || new DOMException('AbortError', 'AbortError'));
                unlisten();
            };
            tx.addEventListener('complete', complete);
            tx.addEventListener('error', error);
            tx.addEventListener('abort', error);
        });
        // Cache it for later retrieval.
        transactionDoneMap.set(tx, done);
    }
    let idbProxyTraps = {
        get(target, prop, receiver) {
            if (target instanceof IDBTransaction) {
                // Special handling for transaction.done.
                if (prop === 'done')
                    return transactionDoneMap.get(target);
                // Polyfill for objectStoreNames because of Edge.
                if (prop === 'objectStoreNames') {
                    return target.objectStoreNames || transactionStoreNamesMap.get(target);
                }
                // Make tx.store return the only store in the transaction, or undefined if there are many.
                if (prop === 'store') {
                    return receiver.objectStoreNames[1]
                        ? undefined
                        : receiver.objectStore(receiver.objectStoreNames[0]);
                }
            }
            // Else transform whatever we get back.
            return wrap(target[prop]);
        },
        set(target, prop, value) {
            target[prop] = value;
            return true;
        },
        has(target, prop) {
            if (target instanceof IDBTransaction &&
                (prop === 'done' || prop === 'store')) {
                return true;
            }
            return prop in target;
        },
    };
    function replaceTraps(callback) {
        idbProxyTraps = callback(idbProxyTraps);
    }
    function wrapFunction(func) {
        // Due to expected object equality (which is enforced by the caching in `wrap`), we
        // only create one new func per func.
        // Edge doesn't support objectStoreNames (booo), so we polyfill it here.
        if (func === IDBDatabase.prototype.transaction &&
            !('objectStoreNames' in IDBTransaction.prototype)) {
            return function (storeNames, ...args) {
                const tx = func.call(unwrap(this), storeNames, ...args);
                transactionStoreNamesMap.set(tx, storeNames.sort ? storeNames.sort() : [storeNames]);
                return wrap(tx);
            };
        }
        // Cursor methods are special, as the behaviour is a little more different to standard IDB. In
        // IDB, you advance the cursor and wait for a new 'success' on the IDBRequest that gave you the
        // cursor. It's kinda like a promise that can resolve with many values. That doesn't make sense
        // with real promises, so each advance methods returns a new promise for the cursor object, or
        // undefined if the end of the cursor has been reached.
        if (getCursorAdvanceMethods().includes(func)) {
            return function (...args) {
                // Calling the original function with the proxy as 'this' causes ILLEGAL INVOCATION, so we use
                // the original object.
                func.apply(unwrap(this), args);
                return wrap(cursorRequestMap.get(this));
            };
        }
        return function (...args) {
            // Calling the original function with the proxy as 'this' causes ILLEGAL INVOCATION, so we use
            // the original object.
            return wrap(func.apply(unwrap(this), args));
        };
    }
    function transformCachableValue(value) {
        if (typeof value === 'function')
            return wrapFunction(value);
        // This doesn't return, it just creates a 'done' promise for the transaction,
        // which is later returned for transaction.done (see idbObjectHandler).
        if (value instanceof IDBTransaction)
            cacheDonePromiseForTransaction(value);
        if (instanceOfAny(value, getIdbProxyableTypes()))
            return new Proxy(value, idbProxyTraps);
        // Return the same value back if we're not going to transform it.
        return value;
    }
    function wrap(value) {
        // We sometimes generate multiple promises from a single IDBRequest (eg when cursoring), because
        // IDB is weird and a single IDBRequest can yield many responses, so these can't be cached.
        if (value instanceof IDBRequest)
            return promisifyRequest(value);
        // If we've already transformed this value before, reuse the transformed value.
        // This is faster, but it also provides object equality.
        if (transformCache.has(value))
            return transformCache.get(value);
        const newValue = transformCachableValue(value);
        // Not all types are transformed.
        // These may be primitive types, so they can't be WeakMap keys.
        if (newValue !== value) {
            transformCache.set(value, newValue);
            reverseTransformCache.set(newValue, value);
        }
        return newValue;
    }
    const unwrap = (value) => reverseTransformCache.get(value);

    /**
     * Open a database.
     *
     * @param name Name of the database.
     * @param version Schema version.
     * @param callbacks Additional callbacks.
     */
    function openDB(name, version, { blocked, upgrade, blocking, terminated } = {}) {
        const request = indexedDB.open(name, version);
        const openPromise = wrap(request);
        if (upgrade) {
            request.addEventListener('upgradeneeded', (event) => {
                upgrade(wrap(request.result), event.oldVersion, event.newVersion, wrap(request.transaction));
            });
        }
        if (blocked)
            request.addEventListener('blocked', () => blocked());
        openPromise
            .then((db) => {
            if (terminated)
                db.addEventListener('close', () => terminated());
            if (blocking)
                db.addEventListener('versionchange', () => blocking());
        })
            .catch(() => { });
        return openPromise;
    }

    const readMethods = ['get', 'getKey', 'getAll', 'getAllKeys', 'count'];
    const writeMethods = ['put', 'add', 'delete', 'clear'];
    const cachedMethods = new Map();
    function getMethod(target, prop) {
        if (!(target instanceof IDBDatabase &&
            !(prop in target) &&
            typeof prop === 'string')) {
            return;
        }
        if (cachedMethods.get(prop))
            return cachedMethods.get(prop);
        const targetFuncName = prop.replace(/FromIndex$/, '');
        const useIndex = prop !== targetFuncName;
        const isWrite = writeMethods.includes(targetFuncName);
        if (
        // Bail if the target doesn't exist on the target. Eg, getAll isn't in Edge.
        !(targetFuncName in (useIndex ? IDBIndex : IDBObjectStore).prototype) ||
            !(isWrite || readMethods.includes(targetFuncName))) {
            return;
        }
        const method = async function (storeName, ...args) {
            // isWrite ? 'readwrite' : undefined gzipps better, but fails in Edge :(
            const tx = this.transaction(storeName, isWrite ? 'readwrite' : 'readonly');
            let target = tx.store;
            if (useIndex)
                target = target.index(args.shift());
            // Must reject if op rejects.
            // If it's a write operation, must reject if tx.done rejects.
            // Must reject with op rejection first.
            // Must resolve with op value.
            // Must handle both promises (no unhandled rejections)
            return (await Promise.all([
                target[targetFuncName](...args),
                isWrite && tx.done,
            ]))[0];
        };
        cachedMethods.set(prop, method);
        return method;
    }
    replaceTraps((oldTraps) => ({
        ...oldTraps,
        get: (target, prop, receiver) => getMethod(target, prop) || oldTraps.get(target, prop, receiver),
        has: (target, prop) => !!getMethod(target, prop) || oldTraps.has(target, prop),
    }));

    var rollbar_umd_min = createCommonjsModule(function (module, exports) {
    !function(t,e){module.exports=e();}(commonjsGlobal,(function(){return function(t){var e={};function r(n){if(e[n])return e[n].exports;var o=e[n]={i:n,l:!1,exports:{}};return t[n].call(o.exports,o,o.exports,r),o.l=!0,o.exports}return r.m=t,r.c=e,r.d=function(t,e,n){r.o(t,e)||Object.defineProperty(t,e,{enumerable:!0,get:n});},r.r=function(t){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(t,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(t,"__esModule",{value:!0});},r.t=function(t,e){if(1&e&&(t=r(t)),8&e)return t;if(4&e&&"object"==typeof t&&t&&t.__esModule)return t;var n=Object.create(null);if(r.r(n),Object.defineProperty(n,"default",{enumerable:!0,value:t}),2&e&&"string"!=typeof t)for(var o in t)r.d(n,o,function(e){return t[e]}.bind(null,o));return n},r.n=function(t){var e=t&&t.__esModule?function(){return t.default}:function(){return t};return r.d(e,"a",e),e},r.o=function(t,e){return Object.prototype.hasOwnProperty.call(t,e)},r.p="",r(r.s=6)}([function(t,e,r){var n=r(12),o={};function i(t,e){return e===s(t)}function s(t){var e=typeof t;return "object"!==e?e:t?t instanceof Error?"error":{}.toString.call(t).match(/\s([a-zA-Z]+)/)[1].toLowerCase():"null"}function a(t){return i(t,"function")}function u(t){var e=Function.prototype.toString.call(Object.prototype.hasOwnProperty).replace(/[\\^$.*+?()[\]{}|]/g,"\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g,"$1.*?"),r=RegExp("^"+e+"$");return c(t)&&r.test(t)}function c(t){var e=typeof t;return null!=t&&("object"==e||"function"==e)}function l(){var t=v();return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,(function(e){var r=(t+16*Math.random())%16|0;return t=Math.floor(t/16),("x"===e?r:7&r|8).toString(16)}))}var p={strictMode:!1,key:["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],q:{name:"queryKey",parser:/(?:^|&)([^&=]*)=?([^&]*)/g},parser:{strict:/^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,loose:/^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/}};function f(t,e){var r,n;try{r=o.stringify(t);}catch(o){if(e&&a(e))try{r=e(t);}catch(t){n=t;}else n=o;}return {error:n,value:r}}function h(t,e){return function(r,n){try{e(r,n);}catch(e){t.error(e);}}}var d=["log","network","dom","navigation","error","manual"],m=["critical","error","warning","info","debug"];function g(t,e){for(var r=0;r<t.length;++r)if(t[r]===e)return !0;return !1}function v(){return Date.now?+Date.now():+new Date}t.exports={addParamsAndAccessTokenToPath:function(t,e,r){(r=r||{}).access_token=t;var n,o=[];for(n in r)Object.prototype.hasOwnProperty.call(r,n)&&o.push([n,r[n]].join("="));var i="?"+o.sort().join("&");(e=e||{}).path=e.path||"";var s,a=e.path.indexOf("?"),u=e.path.indexOf("#");-1!==a&&(-1===u||u>a)?(s=e.path,e.path=s.substring(0,a)+i+"&"+s.substring(a+1)):-1!==u?(s=e.path,e.path=s.substring(0,u)+i+s.substring(u)):e.path=e.path+i;},createItem:function(t,e,r,o,i){for(var a,u,c,p,f,d,m=[],g=[],y=0,b=t.length;y<b;++y){var w=s(d=t[y]);switch(g.push(w),w){case"undefined":break;case"string":a?m.push(d):a=d;break;case"function":p=h(e,d);break;case"date":m.push(d);break;case"error":case"domexception":case"exception":u?m.push(d):u=d;break;case"object":case"array":if(d instanceof Error||"undefined"!=typeof DOMException&&d instanceof DOMException){u?m.push(d):u=d;break}if(o&&"object"===w&&!f){for(var _=0,x=o.length;_<x;++_)if(void 0!==d[o[_]]){f=d;break}if(f)break}c?m.push(d):c=d;break;default:if(d instanceof Error||"undefined"!=typeof DOMException&&d instanceof DOMException){u?m.push(d):u=d;break}m.push(d);}}m.length>0&&((c=n(c)).extraArgs=m);var k={message:a,err:u,custom:c,timestamp:v(),callback:p,notifier:r,diagnostic:{},uuid:l()};return function(t,e){e&&void 0!==e.level&&(t.level=e.level,delete e.level);e&&void 0!==e.skipFrames&&(t.skipFrames=e.skipFrames,delete e.skipFrames);}(k,c),o&&f&&(k.request=f),i&&(k.lambdaContext=i),k._originalArgs=t,k.diagnostic.original_arg_types=g,k},addErrorContext:function(t,e){var r=t.data.custom||{},o=!1;try{for(var i=0;i<e.length;++i)e[i].hasOwnProperty("rollbarContext")&&(r=n(r,e[i].rollbarContext),o=!0);o&&(t.data.custom=r);}catch(e){t.diagnostic.error_context="Failed: "+e.message;}},createTelemetryEvent:function(t){for(var e,r,n,o,i=0,a=t.length;i<a;++i){switch(s(o=t[i])){case"string":!e&&g(d,o)?e=o:!n&&g(m,o)&&(n=o);break;case"object":r=o;}}return {type:e||"manual",metadata:r||{},level:n}},filterIp:function(t,e){if(t&&t.user_ip&&!0!==e){var r=t.user_ip;if(e)try{var n;if(-1!==r.indexOf("."))(n=r.split(".")).pop(),n.push("0"),r=n.join(".");else if(-1!==r.indexOf(":")){if((n=r.split(":")).length>2){var o=n.slice(0,3),i=o[2].indexOf("/");-1!==i&&(o[2]=o[2].substring(0,i));r=o.concat("0000:0000:0000:0000:0000").join(":");}}else r=null;}catch(t){r=null;}else r=null;t.user_ip=r;}},formatArgsAsString:function(t){var e,r,n,o=[];for(e=0,r=t.length;e<r;++e){switch(s(n=t[e])){case"object":(n=(n=f(n)).error||n.value).length>500&&(n=n.substr(0,497)+"...");break;case"null":n="null";break;case"undefined":n="undefined";break;case"symbol":n=n.toString();}o.push(n);}return o.join(" ")},formatUrl:function(t,e){if(!(e=e||t.protocol)&&t.port&&(80===t.port?e="http:":443===t.port&&(e="https:")),e=e||"https:",!t.hostname)return null;var r=e+"//"+t.hostname;return t.port&&(r=r+":"+t.port),t.path&&(r+=t.path),r},get:function(t,e){if(t){var r=e.split("."),n=t;try{for(var o=0,i=r.length;o<i;++o)n=n[r[o]];}catch(t){n=void 0;}return n}},handleOptions:function(t,e,r,o){var i=n(t,e,r);return i=function(t,e){t.hostWhiteList&&!t.hostSafeList&&(t.hostSafeList=t.hostWhiteList,t.hostWhiteList=void 0,e&&e.log("hostWhiteList is deprecated. Use hostSafeList."));t.hostBlackList&&!t.hostBlockList&&(t.hostBlockList=t.hostBlackList,t.hostBlackList=void 0,e&&e.log("hostBlackList is deprecated. Use hostBlockList."));return t}(i,o),!e||e.overwriteScrubFields||e.scrubFields&&(i.scrubFields=(t.scrubFields||[]).concat(e.scrubFields)),i},isError:function(t){return i(t,"error")||i(t,"exception")},isFiniteNumber:function(t){return Number.isFinite(t)},isFunction:a,isIterable:function(t){var e=s(t);return "object"===e||"array"===e},isNativeFunction:u,isObject:c,isString:function(t){return "string"==typeof t||t instanceof String},isType:i,isPromise:function(t){return c(t)&&i(t.then,"function")},jsonParse:function(t){var e,r;try{e=o.parse(t);}catch(t){r=t;}return {error:r,value:e}},LEVELS:{debug:0,info:1,warning:2,error:3,critical:4},makeUnhandledStackInfo:function(t,e,r,n,o,i,s,a){var u={url:e||"",line:r,column:n};u.func=a.guessFunctionName(u.url,u.line),u.context=a.gatherContext(u.url,u.line);var c="undefined"!=typeof document&&document&&document.location&&document.location.href,l="undefined"!=typeof window&&window&&window.navigator&&window.navigator.userAgent;return {mode:i,message:o?String(o):t||s,url:c,stack:[u],useragent:l}},merge:n,now:v,redact:function(){return "********"},RollbarJSON:o,sanitizeUrl:function(t){var e=function(t){if(!i(t,"string"))return;for(var e=p,r=e.parser[e.strictMode?"strict":"loose"].exec(t),n={},o=0,s=e.key.length;o<s;++o)n[e.key[o]]=r[o]||"";return n[e.q.name]={},n[e.key[12]].replace(e.q.parser,(function(t,r,o){r&&(n[e.q.name][r]=o);})),n}(t);return e?(""===e.anchor&&(e.source=e.source.replace("#","")),t=e.source.replace("?"+e.query,"")):"(unknown)"},set:function(t,e,r){if(t){var n=e.split("."),o=n.length;if(!(o<1))if(1!==o)try{for(var i=t[n[0]]||{},s=i,a=1;a<o-1;++a)i[n[a]]=i[n[a]]||{},i=i[n[a]];i[n[o-1]]=r,t[n[0]]=s;}catch(t){return}else t[n[0]]=r;}},setupJSON:function(t){a(o.stringify)&&a(o.parse)||(i(JSON,"undefined")||(t?(u(JSON.stringify)&&(o.stringify=JSON.stringify),u(JSON.parse)&&(o.parse=JSON.parse)):(a(JSON.stringify)&&(o.stringify=JSON.stringify),a(JSON.parse)&&(o.parse=JSON.parse))),a(o.stringify)&&a(o.parse)||t&&t(o));},stringify:f,maxByteSize:function(t){for(var e=0,r=t.length,n=0;n<r;n++){var o=t.charCodeAt(n);o<128?e+=1:o<2048?e+=2:o<65536&&(e+=3);}return e},typeName:s,uuid4:l};},function(t,e,r){r(17);var n=r(18),o=r(0);t.exports={error:function(){var t=Array.prototype.slice.call(arguments,0);t.unshift("Rollbar:"),n.ieVersion()<=8?console.error(o.formatArgsAsString(t)):console.error.apply(console,t);},info:function(){var t=Array.prototype.slice.call(arguments,0);t.unshift("Rollbar:"),n.ieVersion()<=8?console.info(o.formatArgsAsString(t)):console.info.apply(console,t);},log:function(){var t=Array.prototype.slice.call(arguments,0);t.unshift("Rollbar:"),n.ieVersion()<=8?console.log(o.formatArgsAsString(t)):console.log.apply(console,t);}};},function(t,e,r){t.exports={parse:function(t){var e,r,n={protocol:null,auth:null,host:null,path:null,hash:null,href:t,hostname:null,port:null,pathname:null,search:null,query:null};if(-1!==(e=t.indexOf("//"))?(n.protocol=t.substring(0,e),r=e+2):r=0,-1!==(e=t.indexOf("@",r))&&(n.auth=t.substring(r,e),r=e+1),-1===(e=t.indexOf("/",r))){if(-1===(e=t.indexOf("?",r)))return -1===(e=t.indexOf("#",r))?n.host=t.substring(r):(n.host=t.substring(r,e),n.hash=t.substring(e)),n.hostname=n.host.split(":")[0],n.port=n.host.split(":")[1],n.port&&(n.port=parseInt(n.port,10)),n;n.host=t.substring(r,e),n.hostname=n.host.split(":")[0],n.port=n.host.split(":")[1],n.port&&(n.port=parseInt(n.port,10)),r=e;}else n.host=t.substring(r,e),n.hostname=n.host.split(":")[0],n.port=n.host.split(":")[1],n.port&&(n.port=parseInt(n.port,10)),r=e;if(-1===(e=t.indexOf("#",r))?n.path=t.substring(r):(n.path=t.substring(r,e),n.hash=t.substring(e)),n.path){var o=n.path.split("?");n.pathname=o[0],n.query=o[1],n.search=n.query?"?"+n.query:null;}return n}};},function(t,e,r){var n=r(22),o=new RegExp("^(([a-zA-Z0-9-_$ ]*): *)?(Uncaught )?([a-zA-Z0-9-_$ ]*): ");function i(){return null}function s(t){var e={};return e._stackFrame=t,e.url=t.fileName,e.line=t.lineNumber,e.func=t.functionName,e.column=t.columnNumber,e.args=t.args,e.context=null,e}function a(t,e){return {stack:function(){var r=[];e=e||0;try{r=n.parse(t);}catch(t){r=[];}for(var o=[],i=e;i<r.length;i++)o.push(new s(r[i]));return o}(),message:t.message,name:u(t),rawStack:t.stack,rawException:t}}function u(t){var e=t.name&&t.name.length&&t.name,r=t.constructor.name&&t.constructor.name.length&&t.constructor.name;return e&&r?"Error"===e?r:e:e||r}t.exports={guessFunctionName:function(){return "?"},guessErrorClass:function(t){if(!t||!t.match)return ["Unknown error. There was no error message to display.",""];var e=t.match(o),r="(unknown)";return e&&(r=e[e.length-1],t=(t=t.replace((e[e.length-2]||"")+r+":","")).replace(/(^[\s]+|[\s]+$)/g,"")),[r,t]},gatherContext:i,parse:function(t,e){var r=t;if(r.nested){for(var n=[];r;)n.push(new a(r,e)),r=r.nested,e=0;return n[0].traceChain=n,n[0]}return new a(r,e)},Stack:a,Frame:s};},function(t,e,r){var n=r(0),o=r(5);function i(t,e){var r=e.split("."),o=r.length-1;try{for(var i=0;i<=o;++i)i<o?t=t[r[i]]:t[r[i]]=n.redact();}catch(t){}}t.exports=function(t,e,r){if(e=e||[],r)for(var s=0;s<r.length;++s)i(t,r[s]);var a=function(t){for(var e,r=[],n=0;n<t.length;++n)e="^\\[?(%5[bB])?"+t[n]+"\\[?(%5[bB])?\\]?(%5[dD])?$",r.push(new RegExp(e,"i"));return r}(e),u=function(t){for(var e,r=[],n=0;n<t.length;++n)e="\\[?(%5[bB])?"+t[n]+"\\[?(%5[bB])?\\]?(%5[dD])?",r.push(new RegExp("("+e+"=)([^&\\n]+)","igm"));return r}(e);function c(t,e){return e+n.redact()}return o(t,(function t(e,r,i){var s=function(t,e){var r;for(r=0;r<a.length;++r)if(a[r].test(t)){e=n.redact();break}return e}(e,r);return s===r?n.isType(r,"object")||n.isType(r,"array")?o(r,t,i):function(t){var e;if(n.isType(t,"string"))for(e=0;e<u.length;++e)t=t.replace(u[e],c);return t}(s):s}))};},function(t,e,r){var n=r(0);t.exports=function(t,e,r){var o,i,s,a,u=n.isType(t,"object"),c=n.isType(t,"array"),l=[];if(r=r||{obj:[],mapped:[]},u){if(a=r.obj.indexOf(t),u&&-1!==a)return r.mapped[a]||r.obj[a];r.obj.push(t),a=r.obj.length-1;}if(u)for(o in t)Object.prototype.hasOwnProperty.call(t,o)&&l.push(o);else if(c)for(s=0;s<t.length;++s)l.push(s);var p=u?{}:[],f=!0;for(s=0;s<l.length;++s)i=t[o=l[s]],p[o]=e(o,i,r),f=f&&p[o]===t[o];return u&&!f&&(r.mapped[a]=p),f?t:p};},function(t,e,r){t.exports=r(7);},function(t,e,r){var n=r(8),o="undefined"!=typeof window&&window._rollbarConfig,i=o&&o.globalAlias||"Rollbar",s="undefined"!=typeof window&&window[i]&&"function"==typeof window[i].shimId&&void 0!==window[i].shimId();if("undefined"==typeof window||window._rollbarStartTime||(window._rollbarStartTime=(new Date).getTime()),!s&&o){var a=new n(o);window[i]=a;}else "undefined"!=typeof window?(window.rollbar=n,window._rollbarDidLoad=!0):"undefined"!=typeof self&&(self.rollbar=n,self._rollbarDidLoad=!0);t.exports=n;},function(t,e,r){var n=r(9),o=r(29),i=r(30),s=r(32),a=r(34),u=r(4),c=r(35);n.setComponents({telemeter:o,instrumenter:i,polyfillJSON:s,wrapGlobals:a,scrub:u,truncation:c}),t.exports=n;},function(t,e,r){var n=r(10),o=r(0),i=r(15),s=r(1),a=r(19),u=r(20),c=r(2),l=r(21),p=r(24),f=r(25),h=r(26),d=r(3);function m(t,e){this.options=o.handleOptions(x,t,null,s),this.options._configuredOptions=t;var r=this.components.telemeter,a=this.components.instrumenter,d=this.components.polyfillJSON;this.wrapGlobals=this.components.wrapGlobals,this.scrub=this.components.scrub;var m=this.components.truncation,g=new u(m),v=new i(this.options,g,c,m);r&&(this.telemeter=new r(this.options)),this.client=e||new n(this.options,v,s,this.telemeter,"browser");var y=b(),w="undefined"!=typeof document&&document;this.isChrome=y.chrome&&y.chrome.runtime,this.anonymousErrorsPending=0,function(t,e,r){t.addTransform(l.handleDomException).addTransform(l.handleItemWithError).addTransform(l.ensureItemHasSomethingToSay).addTransform(l.addBaseInfo).addTransform(l.addRequestInfo(r)).addTransform(l.addClientInfo(r)).addTransform(l.addPluginInfo(r)).addTransform(l.addBody).addTransform(p.addMessageWithError).addTransform(p.addTelemetryData).addTransform(p.addConfigToPayload).addTransform(l.addScrubber(e.scrub)).addTransform(p.userTransform(s)).addTransform(p.addConfiguredOptions).addTransform(p.addDiagnosticKeys).addTransform(p.itemToPayload);}(this.client.notifier,this,y),this.client.queue.addPredicate(h.checkLevel).addPredicate(f.checkIgnore).addPredicate(h.userCheckIgnore(s)).addPredicate(h.urlIsNotBlockListed(s)).addPredicate(h.urlIsSafeListed(s)).addPredicate(h.messageIsIgnored(s)),this.setupUnhandledCapture(),a&&(this.instrumenter=new a(this.options,this.client.telemeter,this,y,w),this.instrumenter.instrument()),o.setupJSON(d);}var g=null;function v(t){var e="Rollbar is not initialized";s.error(e),t&&t(new Error(e));}function y(t){for(var e=0,r=t.length;e<r;++e)if(o.isFunction(t[e]))return t[e]}function b(){return "undefined"!=typeof window&&window||"undefined"!=typeof self&&self}m.init=function(t,e){return g?g.global(t).configure(t):g=new m(t,e)},m.prototype.components={},m.setComponents=function(t){m.prototype.components=t;},m.prototype.global=function(t){return this.client.global(t),this},m.global=function(t){if(g)return g.global(t);v();},m.prototype.configure=function(t,e){var r=this.options,n={};return e&&(n={payload:e}),this.options=o.handleOptions(r,t,n,s),this.options._configuredOptions=o.handleOptions(r._configuredOptions,t,n),this.client.configure(this.options,e),this.instrumenter&&this.instrumenter.configure(this.options),this.setupUnhandledCapture(),this},m.configure=function(t,e){if(g)return g.configure(t,e);v();},m.prototype.lastError=function(){return this.client.lastError},m.lastError=function(){if(g)return g.lastError();v();},m.prototype.log=function(){var t=this._createItem(arguments),e=t.uuid;return this.client.log(t),{uuid:e}},m.log=function(){if(g)return g.log.apply(g,arguments);var t=y(arguments);v(t);},m.prototype.debug=function(){var t=this._createItem(arguments),e=t.uuid;return this.client.debug(t),{uuid:e}},m.debug=function(){if(g)return g.debug.apply(g,arguments);var t=y(arguments);v(t);},m.prototype.info=function(){var t=this._createItem(arguments),e=t.uuid;return this.client.info(t),{uuid:e}},m.info=function(){if(g)return g.info.apply(g,arguments);var t=y(arguments);v(t);},m.prototype.warn=function(){var t=this._createItem(arguments),e=t.uuid;return this.client.warn(t),{uuid:e}},m.warn=function(){if(g)return g.warn.apply(g,arguments);var t=y(arguments);v(t);},m.prototype.warning=function(){var t=this._createItem(arguments),e=t.uuid;return this.client.warning(t),{uuid:e}},m.warning=function(){if(g)return g.warning.apply(g,arguments);var t=y(arguments);v(t);},m.prototype.error=function(){var t=this._createItem(arguments),e=t.uuid;return this.client.error(t),{uuid:e}},m.error=function(){if(g)return g.error.apply(g,arguments);var t=y(arguments);v(t);},m.prototype.critical=function(){var t=this._createItem(arguments),e=t.uuid;return this.client.critical(t),{uuid:e}},m.critical=function(){if(g)return g.critical.apply(g,arguments);var t=y(arguments);v(t);},m.prototype.buildJsonPayload=function(t){return this.client.buildJsonPayload(t)},m.buildJsonPayload=function(){if(g)return g.buildJsonPayload.apply(g,arguments);v();},m.prototype.sendJsonPayload=function(t){return this.client.sendJsonPayload(t)},m.sendJsonPayload=function(){if(g)return g.sendJsonPayload.apply(g,arguments);v();},m.prototype.setupUnhandledCapture=function(){var t=b();this.unhandledExceptionsInitialized||(this.options.captureUncaught||this.options.handleUncaughtExceptions)&&(a.captureUncaughtExceptions(t,this),this.wrapGlobals&&this.options.wrapGlobalEventHandlers&&this.wrapGlobals(t,this),this.unhandledExceptionsInitialized=!0),this.unhandledRejectionsInitialized||(this.options.captureUnhandledRejections||this.options.handleUnhandledRejections)&&(a.captureUnhandledRejections(t,this),this.unhandledRejectionsInitialized=!0);},m.prototype.handleUncaughtException=function(t,e,r,n,i,s){if(this.options.captureUncaught||this.options.handleUncaughtExceptions){if(this.options.inspectAnonymousErrors&&this.isChrome&&null===i&&""===e)return "anonymous";var a,u=o.makeUnhandledStackInfo(t,e,r,n,i,"onerror","uncaught exception",d);o.isError(i)?(a=this._createItem([t,i,s]))._unhandledStackInfo=u:o.isError(e)?(a=this._createItem([t,e,s]))._unhandledStackInfo=u:(a=this._createItem([t,s])).stackInfo=u,a.level=this.options.uncaughtErrorLevel,a._isUncaught=!0,this.client.log(a);}},m.prototype.handleAnonymousErrors=function(){if(this.options.inspectAnonymousErrors&&this.isChrome){var t=this;try{Error.prepareStackTrace=function(e,r){if(t.options.inspectAnonymousErrors&&t.anonymousErrorsPending){if(t.anonymousErrorsPending-=1,!e)return;e._isAnonymous=!0,t.handleUncaughtException(e.message,null,null,null,e);}return e.stack};}catch(t){this.options.inspectAnonymousErrors=!1,this.error("anonymous error handler failed",t);}}},m.prototype.handleUnhandledRejection=function(t,e){if(this.options.captureUnhandledRejections||this.options.handleUnhandledRejections){var r="unhandled rejection was null or undefined!";if(t)if(t.message)r=t.message;else {var n=o.stringify(t);n.value&&(r=n.value);}var i,s=t&&t._rollbarContext||e&&e._rollbarContext;o.isError(t)?i=this._createItem([r,t,s]):(i=this._createItem([r,t,s])).stackInfo=o.makeUnhandledStackInfo(r,"",0,0,null,"unhandledrejection","",d),i.level=this.options.uncaughtErrorLevel,i._isUncaught=!0,i._originalArgs=i._originalArgs||[],i._originalArgs.push(e),this.client.log(i);}},m.prototype.wrap=function(t,e,r){try{var n;if(n=o.isFunction(e)?e:function(){return e||{}},!o.isFunction(t))return t;if(t._isWrap)return t;if(!t._rollbar_wrapped&&(t._rollbar_wrapped=function(){r&&o.isFunction(r)&&r.apply(this,arguments);try{return t.apply(this,arguments)}catch(r){var e=r;throw e&&window._rollbarWrappedError!==e&&(o.isType(e,"string")&&(e=new String(e)),e._rollbarContext=n()||{},e._rollbarContext._wrappedSource=t.toString(),window._rollbarWrappedError=e),e}},t._rollbar_wrapped._isWrap=!0,t.hasOwnProperty))for(var i in t)t.hasOwnProperty(i)&&"_rollbar_wrapped"!==i&&(t._rollbar_wrapped[i]=t[i]);return t._rollbar_wrapped}catch(e){return t}},m.wrap=function(t,e){if(g)return g.wrap(t,e);v();},m.prototype.captureEvent=function(){var t=o.createTelemetryEvent(arguments);return this.client.captureEvent(t.type,t.metadata,t.level)},m.captureEvent=function(){if(g)return g.captureEvent.apply(g,arguments);v();},m.prototype.captureDomContentLoaded=function(t,e){return e||(e=new Date),this.client.captureDomContentLoaded(e)},m.prototype.captureLoad=function(t,e){return e||(e=new Date),this.client.captureLoad(e)},m.prototype.loadFull=function(){s.info("Unexpected Rollbar.loadFull() called on a Notifier instance. This can happen when Rollbar is loaded multiple times.");},m.prototype._createItem=function(t){return o.createItem(t,s,this)};var w=r(27),_=r(28),x={version:w.version,scrubFields:_.scrubFields,logLevel:w.logLevel,reportLevel:w.reportLevel,uncaughtErrorLevel:w.uncaughtErrorLevel,endpoint:w.endpoint,verbose:!1,enabled:!0,transmit:!0,sendConfig:!1,includeItemsInTelemetry:!0,captureIp:!0,inspectAnonymousErrors:!0,ignoreDuplicateErrors:!0,wrapGlobalEventHandlers:!1};t.exports=m;},function(t,e,r){var n=r(11),o=r(13),i=r(14),s=r(0);function a(t,e,r,n,l){this.options=s.merge(t),this.logger=r,a.rateLimiter.configureGlobal(this.options),a.rateLimiter.setPlatformOptions(l,this.options),this.api=e,this.queue=new o(a.rateLimiter,e,r,this.options);var p=this.options.tracer||null;c(p)?(this.tracer=p,this.options.tracer="opentracing-tracer-enabled",this.options._configuredOptions.tracer="opentracing-tracer-enabled"):this.tracer=null,this.notifier=new i(this.queue,this.options),this.telemeter=n,u(t),this.lastError=null,this.lastErrorHash="none";}function u(t){t.stackTraceLimit&&(Error.stackTraceLimit=t.stackTraceLimit);}function c(t){if(!t)return !1;if(!t.scope||"function"!=typeof t.scope)return !1;var e=t.scope();return !(!e||!e.active||"function"!=typeof e.active)}a.rateLimiter=new n({maxItems:0,itemsPerMinute:60}),a.prototype.global=function(t){return a.rateLimiter.configureGlobal(t),this},a.prototype.configure=function(t,e){var r=this.options,n={};e&&(n={payload:e}),this.options=s.merge(r,t,n);var o=this.options.tracer||null;return c(o)?(this.tracer=o,this.options.tracer="opentracing-tracer-enabled",this.options._configuredOptions.tracer="opentracing-tracer-enabled"):this.tracer=null,this.notifier&&this.notifier.configure(this.options),this.telemeter&&this.telemeter.configure(this.options),u(t),this.global(this.options),c(t.tracer)&&(this.tracer=t.tracer),this},a.prototype.log=function(t){var e=this._defaultLogLevel();return this._log(e,t)},a.prototype.debug=function(t){this._log("debug",t);},a.prototype.info=function(t){this._log("info",t);},a.prototype.warn=function(t){this._log("warning",t);},a.prototype.warning=function(t){this._log("warning",t);},a.prototype.error=function(t){this._log("error",t);},a.prototype.critical=function(t){this._log("critical",t);},a.prototype.wait=function(t){this.queue.wait(t);},a.prototype.captureEvent=function(t,e,r){return this.telemeter&&this.telemeter.captureEvent(t,e,r)},a.prototype.captureDomContentLoaded=function(t){return this.telemeter&&this.telemeter.captureDomContentLoaded(t)},a.prototype.captureLoad=function(t){return this.telemeter&&this.telemeter.captureLoad(t)},a.prototype.buildJsonPayload=function(t){return this.api.buildJsonPayload(t)},a.prototype.sendJsonPayload=function(t){this.api.postJsonPayload(t);},a.prototype._log=function(t,e){var r;if(e.callback&&(r=e.callback,delete e.callback),this.options.ignoreDuplicateErrors&&this._sameAsLastError(e)){if(r){var n=new Error("ignored identical item");n.item=e,r(n);}}else try{this._addTracingInfo(e),e.level=e.level||t,this.telemeter&&this.telemeter._captureRollbarItem(e),e.telemetryEvents=this.telemeter&&this.telemeter.copyEvents()||[],this.notifier.log(e,r);}catch(t){r&&r(t),this.logger.error(t);}},a.prototype._defaultLogLevel=function(){return this.options.logLevel||"debug"},a.prototype._sameAsLastError=function(t){if(!t._isUncaught)return !1;var e=function(t){var e=t.message||"",r=(t.err||{}).stack||String(t.err);return e+"::"+r}(t);return this.lastErrorHash===e||(this.lastError=t.err,this.lastErrorHash=e,!1)},a.prototype._addTracingInfo=function(t){if(this.tracer){var e=this.tracer.scope().active();if(function(t){if(!t||!t.context||"function"!=typeof t.context)return !1;var e=t.context();if(!e||!e.toSpanId||!e.toTraceId||"function"!=typeof e.toSpanId||"function"!=typeof e.toTraceId)return !1;return !0}(e)){e.setTag("rollbar.error_uuid",t.uuid),e.setTag("rollbar.has_error",!0),e.setTag("error",!0),e.setTag("rollbar.item_url","https://rollbar.com/item/uuid/?uuid="+t.uuid),e.setTag("rollbar.occurrence_url","https://rollbar.com/occurrence/uuid/?uuid="+t.uuid);var r=e.context().toSpanId(),n=e.context().toTraceId();t.custom?(t.custom.opentracing_span_id=r,t.custom.opentracing_trace_id=n):t.custom={opentracing_span_id:r,opentracing_trace_id:n};}}},t.exports=a;},function(t,e,r){var n=r(0);function o(t){this.startTime=n.now(),this.counter=0,this.perMinCounter=0,this.platform=null,this.platformOptions={},this.configureGlobal(t);}function i(t,e,r){return !t.ignoreRateLimit&&e>=1&&r>e}function s(t,e,r,n,o,i,s){var a=null;return r&&(r=new Error(r)),r||n||(a=function(t,e,r,n,o){var i,s=e.environment||e.payload&&e.payload.environment;i=o?"item per minute limit reached, ignoring errors until timeout":"maxItems has been hit, ignoring errors until reset.";var a={body:{message:{body:i,extra:{maxItems:r,itemsPerMinute:n}}},language:"javascript",environment:s,notifier:{version:e.notifier&&e.notifier.version||e.version}};"browser"===t?(a.platform="browser",a.framework="browser-js",a.notifier.name="rollbar-browser-js"):"server"===t?(a.framework=e.framework||"node-js",a.notifier.name=e.notifier.name):"react-native"===t&&(a.framework=e.framework||"react-native",a.notifier.name=e.notifier.name);return a}(t,e,o,i,s)),{error:r,shouldSend:n,payload:a}}o.globalSettings={startTime:n.now(),maxItems:void 0,itemsPerMinute:void 0},o.prototype.configureGlobal=function(t){void 0!==t.startTime&&(o.globalSettings.startTime=t.startTime),void 0!==t.maxItems&&(o.globalSettings.maxItems=t.maxItems),void 0!==t.itemsPerMinute&&(o.globalSettings.itemsPerMinute=t.itemsPerMinute);},o.prototype.shouldSend=function(t,e){var r=(e=e||n.now())-this.startTime;(r<0||r>=6e4)&&(this.startTime=e,this.perMinCounter=0);var a=o.globalSettings.maxItems,u=o.globalSettings.itemsPerMinute;if(i(t,a,this.counter))return s(this.platform,this.platformOptions,a+" max items reached",!1);if(i(t,u,this.perMinCounter))return s(this.platform,this.platformOptions,u+" items per minute reached",!1);this.counter++,this.perMinCounter++;var c=!i(t,a,this.counter),l=c;return c=c&&!i(t,u,this.perMinCounter),s(this.platform,this.platformOptions,null,c,a,u,l)},o.prototype.setPlatformOptions=function(t,e){this.platform=t,this.platformOptions=e;},t.exports=o;},function(t,e,r){var n=Object.prototype.hasOwnProperty,o=Object.prototype.toString,i=function(t){if(!t||"[object Object]"!==o.call(t))return !1;var e,r=n.call(t,"constructor"),i=t.constructor&&t.constructor.prototype&&n.call(t.constructor.prototype,"isPrototypeOf");if(t.constructor&&!r&&!i)return !1;for(e in t);return void 0===e||n.call(t,e)};t.exports=function t(){var e,r,n,o,s,a={},u=null,c=arguments.length;for(e=0;e<c;e++)if(null!=(u=arguments[e]))for(s in u)r=a[s],a!==(n=u[s])&&(n&&i(n)?(o=r&&i(r)?r:{},a[s]=t(o,n)):void 0!==n&&(a[s]=n));return a};},function(t,e,r){var n=r(0);function o(t,e,r,n){this.rateLimiter=t,this.api=e,this.logger=r,this.options=n,this.predicates=[],this.pendingItems=[],this.pendingRequests=[],this.retryQueue=[],this.retryHandle=null,this.waitCallback=null,this.waitIntervalID=null;}o.prototype.configure=function(t){this.api&&this.api.configure(t);var e=this.options;return this.options=n.merge(e,t),this},o.prototype.addPredicate=function(t){return n.isFunction(t)&&this.predicates.push(t),this},o.prototype.addPendingItem=function(t){this.pendingItems.push(t);},o.prototype.removePendingItem=function(t){var e=this.pendingItems.indexOf(t);-1!==e&&this.pendingItems.splice(e,1);},o.prototype.addItem=function(t,e,r,o){e&&n.isFunction(e)||(e=function(){});var i=this._applyPredicates(t);if(i.stop)return this.removePendingItem(o),void e(i.err);if(this._maybeLog(t,r),this.removePendingItem(o),this.options.transmit){this.pendingRequests.push(t);try{this._makeApiRequest(t,function(r,n){this._dequeuePendingRequest(t),e(r,n);}.bind(this));}catch(r){this._dequeuePendingRequest(t),e(r);}}else e(new Error("Transmit disabled"));},o.prototype.wait=function(t){n.isFunction(t)&&(this.waitCallback=t,this._maybeCallWait()||(this.waitIntervalID&&(this.waitIntervalID=clearInterval(this.waitIntervalID)),this.waitIntervalID=setInterval(function(){this._maybeCallWait();}.bind(this),500)));},o.prototype._applyPredicates=function(t){for(var e=null,r=0,n=this.predicates.length;r<n;r++)if(!(e=this.predicates[r](t,this.options))||void 0!==e.err)return {stop:!0,err:e.err};return {stop:!1,err:null}},o.prototype._makeApiRequest=function(t,e){var r=this.rateLimiter.shouldSend(t);r.shouldSend?this.api.postItem(t,function(r,n){r?this._maybeRetry(r,t,e):e(r,n);}.bind(this)):r.error?e(r.error):this.api.postItem(r.payload,e);};var i=["ECONNRESET","ENOTFOUND","ESOCKETTIMEDOUT","ETIMEDOUT","ECONNREFUSED","EHOSTUNREACH","EPIPE","EAI_AGAIN"];o.prototype._maybeRetry=function(t,e,r){var o=!1;if(this.options.retryInterval){for(var s=0,a=i.length;s<a;s++)if(t.code===i[s]){o=!0;break}o&&n.isFiniteNumber(this.options.maxRetries)&&(e.retries=e.retries?e.retries+1:1,e.retries>this.options.maxRetries&&(o=!1));}o?this._retryApiRequest(e,r):r(t);},o.prototype._retryApiRequest=function(t,e){this.retryQueue.push({item:t,callback:e}),this.retryHandle||(this.retryHandle=setInterval(function(){for(;this.retryQueue.length;){var t=this.retryQueue.shift();this._makeApiRequest(t.item,t.callback);}}.bind(this),this.options.retryInterval));},o.prototype._dequeuePendingRequest=function(t){var e=this.pendingRequests.indexOf(t);-1!==e&&(this.pendingRequests.splice(e,1),this._maybeCallWait());},o.prototype._maybeLog=function(t,e){if(this.logger&&this.options.verbose){var r=e;if(r=(r=r||n.get(t,"body.trace.exception.message"))||n.get(t,"body.trace_chain.0.exception.message"))return void this.logger.error(r);(r=n.get(t,"body.message.body"))&&this.logger.log(r);}},o.prototype._maybeCallWait=function(){return !(!n.isFunction(this.waitCallback)||0!==this.pendingItems.length||0!==this.pendingRequests.length)&&(this.waitIntervalID&&(this.waitIntervalID=clearInterval(this.waitIntervalID)),this.waitCallback(),!0)},t.exports=o;},function(t,e,r){var n=r(0);function o(t,e){this.queue=t,this.options=e,this.transforms=[],this.diagnostic={};}o.prototype.configure=function(t){this.queue&&this.queue.configure(t);var e=this.options;return this.options=n.merge(e,t),this},o.prototype.addTransform=function(t){return n.isFunction(t)&&this.transforms.push(t),this},o.prototype.log=function(t,e){if(e&&n.isFunction(e)||(e=function(){}),!this.options.enabled)return e(new Error("Rollbar is not enabled"));this.queue.addPendingItem(t);var r=t.err;this._applyTransforms(t,function(n,o){if(n)return this.queue.removePendingItem(t),e(n,null);this.queue.addItem(o,e,r,t);}.bind(this));},o.prototype._applyTransforms=function(t,e){var r=-1,n=this.transforms.length,o=this.transforms,i=this.options,s=function(t,a){t?e(t,null):++r!==n?o[r](a,i,s):e(null,a);};s(null,t);},t.exports=o;},function(t,e,r){var n=r(0),o=r(16),i={hostname:"api.rollbar.com",path:"/api/1/item/",search:null,version:"1",protocol:"https:",port:443};function s(t,e,r,n,o){this.options=t,this.transport=e,this.url=r,this.truncation=n,this.jsonBackup=o,this.accessToken=t.accessToken,this.transportOptions=a(t,r);}function a(t,e){return o.getTransportFromOptions(t,i,e)}s.prototype.postItem=function(t,e){var r=o.transportOptions(this.transportOptions,"POST"),n=o.buildPayload(this.accessToken,t,this.jsonBackup);this.transport.post(this.accessToken,r,n,e);},s.prototype.buildJsonPayload=function(t,e){var r,i=o.buildPayload(this.accessToken,t,this.jsonBackup);return (r=this.truncation?this.truncation.truncate(i):n.stringify(i)).error?(e&&e(r.error),null):r.value},s.prototype.postJsonPayload=function(t,e){var r=o.transportOptions(this.transportOptions,"POST");this.transport.postJsonPayload(this.accessToken,r,t,e);},s.prototype.configure=function(t){var e=this.oldOptions;return this.options=n.merge(e,t),this.transportOptions=a(this.options,this.url),void 0!==this.options.accessToken&&(this.accessToken=this.options.accessToken),this},t.exports=s;},function(t,e,r){var n=r(0);t.exports={buildPayload:function(t,e,r){if(!n.isType(e.context,"string")){var o=n.stringify(e.context,r);o.error?e.context="Error: could not serialize 'context'":e.context=o.value||"",e.context.length>255&&(e.context=e.context.substr(0,255));}return {access_token:t,data:e}},getTransportFromOptions:function(t,e,r){var n=e.hostname,o=e.protocol,i=e.port,s=e.path,a=e.search,u=t.timeout,c=t.proxy;if(t.endpoint){var l=r.parse(t.endpoint);n=l.hostname,o=l.protocol,i=l.port,s=l.pathname,a=l.search;}return {timeout:u,hostname:n,protocol:o,port:i,path:s,search:a,proxy:c}},transportOptions:function(t,e){var r=t.protocol||"https:",n=t.port||("http:"===r?80:"https:"===r?443:void 0),o=t.hostname,i=t.path,s=t.timeout;return t.search&&(i+=t.search),t.proxy&&(i=r+"//"+o+i,o=t.proxy.host||t.proxy.hostname,n=t.proxy.port,r=t.proxy.protocol||r),{timeout:s,protocol:r,hostname:o,path:i,port:n,method:e}},appendPathToPath:function(t,e){var r=/\/$/.test(t),n=/^\//.test(e);return r&&n?e=e.substring(1):r||n||(e="/"+e),t+e}};},function(t,e){!function(t){t.console||(t.console={});for(var e,r,n=t.console,o=function(){},i=["memory"],s="assert,clear,count,debug,dir,dirxml,error,exception,group,groupCollapsed,groupEnd,info,log,markTimeline,profile,profiles,profileEnd,show,table,time,timeEnd,timeline,timelineEnd,timeStamp,trace,warn".split(",");e=i.pop();)n[e]||(n[e]={});for(;r=s.pop();)n[r]||(n[r]=o);}("undefined"==typeof window?this:window);},function(t,e,r){var n={ieVersion:function(){if("undefined"!=typeof document){for(var t=3,e=document.createElement("div"),r=e.getElementsByTagName("i");e.innerHTML="\x3c!--[if gt IE "+ ++t+"]><i></i><![endif]--\x3e",r[0];);return t>4?t:void 0}}};t.exports=n;},function(t,e,r){function n(t,e,r,n){t._rollbarWrappedError&&(n[4]||(n[4]=t._rollbarWrappedError),n[5]||(n[5]=t._rollbarWrappedError._rollbarContext),t._rollbarWrappedError=null);var o=e.handleUncaughtException.apply(e,n);r&&r.apply(t,n),"anonymous"===o&&(e.anonymousErrorsPending+=1);}t.exports={captureUncaughtExceptions:function(t,e,r){if(t){var o;if("function"==typeof e._rollbarOldOnError)o=e._rollbarOldOnError;else if(t.onerror){for(o=t.onerror;o._rollbarOldOnError;)o=o._rollbarOldOnError;e._rollbarOldOnError=o;}e.handleAnonymousErrors();var i=function(){var r=Array.prototype.slice.call(arguments,0);n(t,e,o,r);};r&&(i._rollbarOldOnError=o),t.onerror=i;}},captureUnhandledRejections:function(t,e,r){if(t){"function"==typeof t._rollbarURH&&t._rollbarURH.belongsToShim&&t.removeEventListener("unhandledrejection",t._rollbarURH);var n=function(t){var r,n,o;try{r=t.reason;}catch(t){r=void 0;}try{n=t.promise;}catch(t){n="[unhandledrejection] error getting `promise` from event";}try{o=t.detail,!r&&o&&(r=o.reason,n=o.promise);}catch(t){}r||(r="[unhandledrejection] error getting `reason` from event"),e&&e.handleUnhandledRejection&&e.handleUnhandledRejection(r,n);};n.belongsToShim=r,t._rollbarURH=n,t.addEventListener("unhandledrejection",n);}}};},function(t,e,r){var n=r(0),o=r(1);function i(t){this.truncation=t;}function s(){var t="undefined"!=typeof window&&window||"undefined"!=typeof self&&self,e=t&&t.Zone&&t.Zone.current,r=Array.prototype.slice.call(arguments);if(e&&"angular"===e._name){var n=e._parent;n.run((function(){a.apply(void 0,r);}));}else a.apply(void 0,r);}function a(t,e,r,i,s,a,c){if("undefined"!=typeof RollbarProxy)return function(t,e){(new RollbarProxy).sendJsonPayload(t,(function(t){}),(function(t){e(new Error(t));}));}(i,s);var l;if(!(l=a?a():function(){var t,e,r=[function(){return new XMLHttpRequest},function(){return new ActiveXObject("Msxml2.XMLHTTP")},function(){return new ActiveXObject("Msxml3.XMLHTTP")},function(){return new ActiveXObject("Microsoft.XMLHTTP")}],n=r.length;for(e=0;e<n;e++)try{t=r[e]();break}catch(t){}return t}()))return s(new Error("No way to send a request"));try{try{var p=function(){try{if(p&&4===l.readyState){p=void 0;var t=n.jsonParse(l.responseText);if((i=l)&&i.status&&200===i.status)return void s(t.error,t.value);if(function(t){return t&&n.isType(t.status,"number")&&t.status>=400&&t.status<600}(l)){if(403===l.status){var e=t.value&&t.value.message;o.error(e);}s(new Error(String(l.status)));}else {s(u("XHR response had no status code (likely connection failure)"));}}}catch(t){var r;r=t&&t.stack?t:new Error(t),s(r);}var i;};l.open(r,e,!0),l.setRequestHeader&&(l.setRequestHeader("Content-Type","application/json"),l.setRequestHeader("X-Rollbar-Access-Token",t)),n.isFiniteNumber(c)&&(l.timeout=c),l.onreadystatechange=p,l.send(i);}catch(t){if("undefined"!=typeof XDomainRequest){if(!window||!window.location)return s(new Error("No window available during request, unknown environment"));"http:"===window.location.href.substring(0,5)&&"https"===e.substring(0,5)&&(e="http"+e.substring(5));var f=new XDomainRequest;f.onprogress=function(){},f.ontimeout=function(){s(u("Request timed out","ETIMEDOUT"));},f.onerror=function(){s(new Error("Error during request"));},f.onload=function(){var t=n.jsonParse(f.responseText);s(t.error,t.value);},f.open(r,e,!0),f.send(i);}else s(new Error("Cannot find a method to transport a request"));}}catch(t){s(t);}}function u(t,e){var r=new Error(t);return r.code=e||"ENOTFOUND",r}i.prototype.get=function(t,e,r,o,i){o&&n.isFunction(o)||(o=function(){}),n.addParamsAndAccessTokenToPath(t,e,r);s(t,n.formatUrl(e),"GET",null,o,i,e.timeout);},i.prototype.post=function(t,e,r,o,i){if(o&&n.isFunction(o)||(o=function(){}),!r)return o(new Error("Cannot send empty request"));var a;if((a=this.truncation?this.truncation.truncate(r):n.stringify(r)).error)return o(a.error);var u=a.value;s(t,n.formatUrl(e),"POST",u,o,i,e.timeout);},i.prototype.postJsonPayload=function(t,e,r,o,i){o&&n.isFunction(o)||(o=function(){});s(t,n.formatUrl(e),"POST",r,o,i,e.timeout);},t.exports=i;},function(t,e,r){var n=r(0),o=r(3),i=r(1);function s(t,e,r){var o=t.message,i=t.custom;o||(o="Item sent with null or missing arguments.");var s={body:o};i&&(s.extra=n.merge(i)),n.set(t,"data.body",{message:s}),r(null,t);}function a(t){var e=t.stackInfo.stack;return e&&0===e.length&&t._unhandledStackInfo&&t._unhandledStackInfo.stack&&(e=t._unhandledStackInfo.stack),e}function u(t,e,r){var i=t&&t.data.description,s=t&&t.custom,u=a(t),l=o.guessErrorClass(e.message),p={exception:{class:c(e,l[0],r),message:l[1]}};if(i&&(p.exception.description=i),u){var f,h,d,m,g,v,y,b;for(0===u.length&&(p.exception.stack=e.rawStack,p.exception.raw=String(e.rawException)),p.frames=[],y=0;y<u.length;++y)h={filename:(f=u[y]).url?n.sanitizeUrl(f.url):"(unknown)",lineno:f.line||null,method:f.func&&"?"!==f.func?f.func:"[anonymous]",colno:f.column},r.sendFrameUrl&&(h.url=f.url),h.method&&h.method.endsWith&&h.method.endsWith("_rollbar_wrapped")||(d=m=g=null,(v=f.context?f.context.length:0)&&(b=Math.floor(v/2),m=f.context.slice(0,b),d=f.context[b],g=f.context.slice(b)),d&&(h.code=d),(m||g)&&(h.context={},m&&m.length&&(h.context.pre=m),g&&g.length&&(h.context.post=g)),f.args&&(h.args=f.args),p.frames.push(h));p.frames.reverse(),s&&(p.extra=n.merge(s));}return p}function c(t,e,r){return t.name?t.name:r.guessErrorClass?e:"(unknown)"}t.exports={handleDomException:function(t,e,r){if(t.err&&"DOMException"===o.Stack(t.err).name){var n=new Error;n.name=t.err.name,n.message=t.err.message,n.stack=t.err.stack,n.nested=t.err,t.err=n;}r(null,t);},handleItemWithError:function(t,e,r){if(t.data=t.data||{},t.err)try{t.stackInfo=t.err._savedStackTrace||o.parse(t.err,t.skipFrames),e.addErrorContext&&function(t){var e=[],r=t.err;e.push(r);for(;r.nested;)r=r.nested,e.push(r);n.addErrorContext(t,e);}(t);}catch(e){i.error("Error while parsing the error object.",e);try{t.message=t.err.message||t.err.description||t.message||String(t.err);}catch(e){t.message=String(t.err)||String(e);}delete t.err;}r(null,t);},ensureItemHasSomethingToSay:function(t,e,r){t.message||t.stackInfo||t.custom||r(new Error("No message, stack info, or custom data"),null),r(null,t);},addBaseInfo:function(t,e,r){var o=e.payload&&e.payload.environment||e.environment;t.data=n.merge(t.data,{environment:o,level:t.level,endpoint:e.endpoint,platform:"browser",framework:"browser-js",language:"javascript",server:{},uuid:t.uuid,notifier:{name:"rollbar-browser-js",version:e.version},custom:t.custom}),r(null,t);},addRequestInfo:function(t){return function(e,r,o){if(!t||!t.location)return o(null,e);var i="$remote_ip";r.captureIp?!0!==r.captureIp&&(i+="_anonymize"):i=null,n.set(e,"data.request",{url:t.location.href,query_string:t.location.search,user_ip:i}),o(null,e);}},addClientInfo:function(t){return function(e,r,o){if(!t)return o(null,e);var i=t.navigator||{},s=t.screen||{};n.set(e,"data.client",{runtime_ms:e.timestamp-t._rollbarStartTime,timestamp:Math.round(e.timestamp/1e3),javascript:{browser:i.userAgent,language:i.language,cookie_enabled:i.cookieEnabled,screen:{width:s.width,height:s.height}}}),o(null,e);}},addPluginInfo:function(t){return function(e,r,o){if(!t||!t.navigator)return o(null,e);for(var i,s=[],a=t.navigator.plugins||[],u=0,c=a.length;u<c;++u)i=a[u],s.push({name:i.name,description:i.description});n.set(e,"data.client.javascript.plugins",s),o(null,e);}},addBody:function(t,e,r){t.stackInfo?t.stackInfo.traceChain?function(t,e,r){for(var o=t.stackInfo.traceChain,i=[],s=o.length,a=0;a<s;a++){var c=u(t,o[a],e);i.push(c);}n.set(t,"data.body",{trace_chain:i}),r(null,t);}(t,e,r):function(t,e,r){if(a(t)){var i=u(t,t.stackInfo,e);n.set(t,"data.body",{trace:i}),r(null,t);}else {var l=t.stackInfo,p=o.guessErrorClass(l.message),f=c(l,p[0],e),h=p[1];t.message=f+": "+h,s(t,e,r);}}(t,e,r):s(t,e,r);},addScrubber:function(t){return function(e,r,n){if(t){var o=r.scrubFields||[],i=r.scrubPaths||[];e.data=t(e.data,o,i);}n(null,e);}}};},function(t,e,r){var n,o,i;!function(s,a){o=[r(23)],void 0===(i="function"==typeof(n=function(t){var e=/(^|@)\S+:\d+/,r=/^\s*at .*(\S+:\d+|\(native\))/m,n=/^(eval@)?(\[native code])?$/;return {parse:function(t){if(void 0!==t.stacktrace||void 0!==t["opera#sourceloc"])return this.parseOpera(t);if(t.stack&&t.stack.match(r))return this.parseV8OrIE(t);if(t.stack)return this.parseFFOrSafari(t);throw new Error("Cannot parse given Error object")},extractLocation:function(t){if(-1===t.indexOf(":"))return [t];var e=/(.+?)(?::(\d+))?(?::(\d+))?$/.exec(t.replace(/[()]/g,""));return [e[1],e[2]||void 0,e[3]||void 0]},parseV8OrIE:function(e){return e.stack.split("\n").filter((function(t){return !!t.match(r)}),this).map((function(e){e.indexOf("(eval ")>-1&&(e=e.replace(/eval code/g,"eval").replace(/(\(eval at [^()]*)|(\),.*$)/g,""));var r=e.replace(/^\s+/,"").replace(/\(eval code/g,"("),n=r.match(/ (\((.+):(\d+):(\d+)\)$)/),o=(r=n?r.replace(n[0],""):r).split(/\s+/).slice(1),i=this.extractLocation(n?n[1]:o.pop()),s=o.join(" ")||void 0,a=["eval","<anonymous>"].indexOf(i[0])>-1?void 0:i[0];return new t({functionName:s,fileName:a,lineNumber:i[1],columnNumber:i[2],source:e})}),this)},parseFFOrSafari:function(e){return e.stack.split("\n").filter((function(t){return !t.match(n)}),this).map((function(e){if(e.indexOf(" > eval")>-1&&(e=e.replace(/ line (\d+)(?: > eval line \d+)* > eval:\d+:\d+/g,":$1")),-1===e.indexOf("@")&&-1===e.indexOf(":"))return new t({functionName:e});var r=/((.*".+"[^@]*)?[^@]*)(?:@)/,n=e.match(r),o=n&&n[1]?n[1]:void 0,i=this.extractLocation(e.replace(r,""));return new t({functionName:o,fileName:i[0],lineNumber:i[1],columnNumber:i[2],source:e})}),this)},parseOpera:function(t){return !t.stacktrace||t.message.indexOf("\n")>-1&&t.message.split("\n").length>t.stacktrace.split("\n").length?this.parseOpera9(t):t.stack?this.parseOpera11(t):this.parseOpera10(t)},parseOpera9:function(e){for(var r=/Line (\d+).*script (?:in )?(\S+)/i,n=e.message.split("\n"),o=[],i=2,s=n.length;i<s;i+=2){var a=r.exec(n[i]);a&&o.push(new t({fileName:a[2],lineNumber:a[1],source:n[i]}));}return o},parseOpera10:function(e){for(var r=/Line (\d+).*script (?:in )?(\S+)(?:: In function (\S+))?$/i,n=e.stacktrace.split("\n"),o=[],i=0,s=n.length;i<s;i+=2){var a=r.exec(n[i]);a&&o.push(new t({functionName:a[3]||void 0,fileName:a[2],lineNumber:a[1],source:n[i]}));}return o},parseOpera11:function(r){return r.stack.split("\n").filter((function(t){return !!t.match(e)&&!t.match(/^Error created at/)}),this).map((function(e){var r,n=e.split("@"),o=this.extractLocation(n.pop()),i=n.shift()||"",s=i.replace(/<anonymous function(: (\w+))?>/,"$2").replace(/\([^)]*\)/g,"")||void 0;i.match(/\(([^)]*)\)/)&&(r=i.replace(/^[^(]+\(([^)]*)\)$/,"$1"));var a=void 0===r||"[arguments not available]"===r?void 0:r.split(",");return new t({functionName:s,args:a,fileName:o[0],lineNumber:o[1],columnNumber:o[2],source:e})}),this)}}})?n.apply(e,o):n)||(t.exports=i);}();},function(t,e,r){var n,o,i;!function(r,s){o=[],void 0===(i="function"==typeof(n=function(){function t(t){return t.charAt(0).toUpperCase()+t.substring(1)}function e(t){return function(){return this[t]}}var r=["isConstructor","isEval","isNative","isToplevel"],n=["columnNumber","lineNumber"],o=["fileName","functionName","source"],i=r.concat(n,o,["args"],["evalOrigin"]);function s(e){if(e)for(var r=0;r<i.length;r++)void 0!==e[i[r]]&&this["set"+t(i[r])](e[i[r]]);}s.prototype={getArgs:function(){return this.args},setArgs:function(t){if("[object Array]"!==Object.prototype.toString.call(t))throw new TypeError("Args must be an Array");this.args=t;},getEvalOrigin:function(){return this.evalOrigin},setEvalOrigin:function(t){if(t instanceof s)this.evalOrigin=t;else {if(!(t instanceof Object))throw new TypeError("Eval Origin must be an Object or StackFrame");this.evalOrigin=new s(t);}},toString:function(){var t=this.getFileName()||"",e=this.getLineNumber()||"",r=this.getColumnNumber()||"",n=this.getFunctionName()||"";return this.getIsEval()?t?"[eval] ("+t+":"+e+":"+r+")":"[eval]:"+e+":"+r:n?n+" ("+t+":"+e+":"+r+")":t+":"+e+":"+r}},s.fromString=function(t){var e=t.indexOf("("),r=t.lastIndexOf(")"),n=t.substring(0,e),o=t.substring(e+1,r).split(","),i=t.substring(r+1);if(0===i.indexOf("@"))var a=/@(.+?)(?::(\d+))?(?::(\d+))?$/.exec(i,""),u=a[1],c=a[2],l=a[3];return new s({functionName:n,args:o||void 0,fileName:u,lineNumber:c||void 0,columnNumber:l||void 0})};for(var a=0;a<r.length;a++)s.prototype["get"+t(r[a])]=e(r[a]),s.prototype["set"+t(r[a])]=function(t){return function(e){this[t]=Boolean(e);}}(r[a]);for(var u=0;u<n.length;u++)s.prototype["get"+t(n[u])]=e(n[u]),s.prototype["set"+t(n[u])]=function(t){return function(e){if(r=e,isNaN(parseFloat(r))||!isFinite(r))throw new TypeError(t+" must be a Number");var r;this[t]=Number(e);}}(n[u]);for(var c=0;c<o.length;c++)s.prototype["get"+t(o[c])]=e(o[c]),s.prototype["set"+t(o[c])]=function(t){return function(e){this[t]=String(e);}}(o[c]);return s})?n.apply(e,o):n)||(t.exports=i);}();},function(t,e,r){var n=r(0);function o(t,e){n.isFunction(t[e])&&(t[e]=t[e].toString());}t.exports={itemToPayload:function(t,e,r){var o=e.payload||{};o.body&&delete o.body;var i=n.merge(t.data,o);t._isUncaught&&(i._isUncaught=!0),t._originalArgs&&(i._originalArgs=t._originalArgs),r(null,i);},addTelemetryData:function(t,e,r){t.telemetryEvents&&n.set(t,"data.body.telemetry",t.telemetryEvents),r(null,t);},addMessageWithError:function(t,e,r){if(t.message){var o="data.body.trace_chain.0",i=n.get(t,o);if(i||(o="data.body.trace",i=n.get(t,o)),i){if(!i.exception||!i.exception.description)return n.set(t,o+".exception.description",t.message),void r(null,t);var s=n.get(t,o+".extra")||{},a=n.merge(s,{message:t.message});n.set(t,o+".extra",a);}r(null,t);}else r(null,t);},userTransform:function(t){return function(e,r,o){var i=n.merge(e),s=null;try{n.isFunction(r.transform)&&(s=r.transform(i.data,e));}catch(n){return r.transform=null,t.error("Error while calling custom transform() function. Removing custom transform().",n),void o(null,e)}n.isPromise(s)?s.then((function(t){t&&(i.data=t),o(null,i);}),(function(t){o(t,e);})):o(null,i);}},addConfigToPayload:function(t,e,r){if(!e.sendConfig)return r(null,t);var o=n.get(t,"data.custom")||{};o._rollbarConfig=e,t.data.custom=o,r(null,t);},addConfiguredOptions:function(t,e,r){var n=e._configuredOptions;o(n,"transform"),o(n,"checkIgnore"),o(n,"onSendCallback"),delete n.accessToken,t.data.notifier.configured_options=n,r(null,t);},addDiagnosticKeys:function(t,e,r){var o=n.merge(t.notifier.client.notifier.diagnostic,t.diagnostic);if(n.get(t,"err._isAnonymous")&&(o.is_anonymous=!0),t._isUncaught&&(o.is_uncaught=t._isUncaught),t.err)try{o.raw_error={message:t.err.message,name:t.err.name,constructor_name:t.err.constructor&&t.err.constructor.name,filename:t.err.fileName,line:t.err.lineNumber,column:t.err.columnNumber,stack:t.err.stack};}catch(t){o.raw_error={failed:String(t)};}t.data.notifier.diagnostic=n.merge(t.data.notifier.diagnostic,o),r(null,t);}};},function(t,e,r){var n=r(0);t.exports={checkIgnore:function(t,e){return !n.get(e,"plugins.jquery.ignoreAjaxErrors")||!n.get(t,"body.message.extra.isAjax")}};},function(t,e,r){var n=r(0);function o(t,e,r){if(!t)return !r;var o,i,s=t.frames;if(!s||0===s.length)return !r;for(var a=e.length,u=s.length,c=0;c<u;c++){if(o=s[c].filename,!n.isType(o,"string"))return !r;for(var l=0;l<a;l++)if(i=e[l],new RegExp(i).test(o))return !0}return !1}function i(t,e,r,i){var s,a,u=!1;"blocklist"===r&&(u=!0);try{if(s=u?e.hostBlockList:e.hostSafeList,a=n.get(t,"body.trace_chain")||[n.get(t,"body.trace")],!s||0===s.length)return !u;if(0===a.length||!a[0])return !u;for(var c=a.length,l=0;l<c;l++)if(o(a[l],s,u))return !0}catch(t){u?e.hostBlockList=null:e.hostSafeList=null;var p=u?"hostBlockList":"hostSafeList";return i.error("Error while reading your configuration's "+p+" option. Removing custom "+p+".",t),!u}return !1}t.exports={checkLevel:function(t,e){var r=t.level,o=n.LEVELS[r]||0,i=e.reportLevel;return !(o<(n.LEVELS[i]||0))},userCheckIgnore:function(t){return function(e,r){var o=!!e._isUncaught;delete e._isUncaught;var i=e._originalArgs;delete e._originalArgs;try{n.isFunction(r.onSendCallback)&&r.onSendCallback(o,i,e);}catch(e){r.onSendCallback=null,t.error("Error while calling onSendCallback, removing",e);}try{if(n.isFunction(r.checkIgnore)&&r.checkIgnore(o,i,e))return !1}catch(e){r.checkIgnore=null,t.error("Error while calling custom checkIgnore(), removing",e);}return !0}},urlIsNotBlockListed:function(t){return function(e,r){return !i(e,r,"blocklist",t)}},urlIsSafeListed:function(t){return function(e,r){return i(e,r,"safelist",t)}},messageIsIgnored:function(t){return function(e,r){var o,i,s,a,u,c;try{if(!1,!(s=r.ignoredMessages)||0===s.length)return !0;if(0===(c=function(t){var e=t.body,r=[];if(e.trace_chain)for(var o=e.trace_chain,i=0;i<o.length;i++){var s=o[i];r.push(n.get(s,"exception.message"));}e.trace&&r.push(n.get(e,"trace.exception.message"));e.message&&r.push(n.get(e,"message.body"));return r}(e)).length)return !0;for(a=s.length,o=0;o<a;o++)for(u=new RegExp(s[o],"gi"),i=0;i<c.length;i++)if(u.test(c[i]))return !1}catch(e){r.ignoredMessages=null,t.error("Error while reading your configuration's ignoredMessages option. Removing custom ignoredMessages.");}return !0}}};},function(t,e,r){t.exports={version:"2.23.0",endpoint:"api.rollbar.com/api/1/item/",logLevel:"debug",reportLevel:"debug",uncaughtErrorLevel:"error",maxItems:0,itemsPerMin:60};},function(t,e,r){t.exports={scrubFields:["pw","pass","passwd","password","secret","confirm_password","confirmPassword","password_confirmation","passwordConfirmation","access_token","accessToken","X-Rollbar-Access-Token","secret_key","secretKey","secretToken","cc-number","card number","cardnumber","cardnum","ccnum","ccnumber","cc num","creditcardnumber","credit card number","newcreditcardnumber","new credit card","creditcardno","credit card no","card#","card #","cc-csc","cvc","cvc2","cvv2","ccv2","security code","card verification","name on credit card","name on card","nameoncard","cardholder","card holder","name des karteninhabers","ccname","card type","cardtype","cc type","cctype","payment type","expiration date","expirationdate","expdate","cc-exp","ccmonth","ccyear"]};},function(t,e,r){var n=r(0);function o(t){this.queue=[],this.options=n.merge(t);var e=this.options.maxTelemetryEvents||100;this.maxQueueSize=Math.max(0,Math.min(e,100));}function i(t,e){if(e)return e;return {error:"error",manual:"info"}[t]||"info"}o.prototype.configure=function(t){var e=this.options;this.options=n.merge(e,t);var r=this.options.maxTelemetryEvents||100,o=Math.max(0,Math.min(r,100)),i=0;this.maxQueueSize>o&&(i=this.maxQueueSize-o),this.maxQueueSize=o,this.queue.splice(0,i);},o.prototype.copyEvents=function(){var t=Array.prototype.slice.call(this.queue,0);if(n.isFunction(this.options.filterTelemetry))try{for(var e=t.length;e--;)this.options.filterTelemetry(t[e])&&t.splice(e,1);}catch(t){this.options.filterTelemetry=null;}return t},o.prototype.capture=function(t,e,r,o,s){var a={level:i(t,r),type:t,timestamp_ms:s||n.now(),body:e,source:"client"};o&&(a.uuid=o);try{if(n.isFunction(this.options.filterTelemetry)&&this.options.filterTelemetry(a))return !1}catch(t){this.options.filterTelemetry=null;}return this.push(a),a},o.prototype.captureEvent=function(t,e,r,n){return this.capture(t,e,r,n)},o.prototype.captureError=function(t,e,r,n){var o={message:t.message||String(t)};return t.stack&&(o.stack=t.stack),this.capture("error",o,e,r,n)},o.prototype.captureLog=function(t,e,r,n){return this.capture("log",{message:t},e,r,n)},o.prototype.captureNetwork=function(t,e,r,n){e=e||"xhr",t.subtype=t.subtype||e,n&&(t.request=n);var o=this.levelFromStatus(t.status_code);return this.capture("network",t,o,r)},o.prototype.levelFromStatus=function(t){return t>=200&&t<400?"info":0===t||t>=400?"error":"info"},o.prototype.captureDom=function(t,e,r,n,o){var i={subtype:t,element:e};return void 0!==r&&(i.value=r),void 0!==n&&(i.checked=n),this.capture("dom",i,"info",o)},o.prototype.captureNavigation=function(t,e,r){return this.capture("navigation",{from:t,to:e},"info",r)},o.prototype.captureDomContentLoaded=function(t){return this.capture("navigation",{subtype:"DOMContentLoaded"},"info",void 0,t&&t.getTime())},o.prototype.captureLoad=function(t){return this.capture("navigation",{subtype:"load"},"info",void 0,t&&t.getTime())},o.prototype.captureConnectivityChange=function(t,e){return this.captureNetwork({change:t},"connectivity",e)},o.prototype._captureRollbarItem=function(t){if(this.options.includeItemsInTelemetry)return t.err?this.captureError(t.err,t.level,t.uuid,t.timestamp):t.message?this.captureLog(t.message,t.level,t.uuid,t.timestamp):t.custom?this.capture("log",t.custom,t.level,t.uuid,t.timestamp):void 0},o.prototype.push=function(t){this.queue.push(t),this.queue.length>this.maxQueueSize&&this.queue.shift();},t.exports=o;},function(t,e,r){var n=r(0),o=r(4),i=r(2),s=r(31),a={network:!0,networkResponseHeaders:!1,networkResponseBody:!1,networkRequestHeaders:!1,networkRequestBody:!1,networkErrorOnHttp5xx:!1,networkErrorOnHttp4xx:!1,networkErrorOnHttp0:!1,log:!0,dom:!0,navigation:!0,connectivity:!0,contentSecurityPolicy:!0,errorOnContentSecurityPolicy:!1};function u(t,e,r,n,o){var i=t[e];t[e]=r(i),n&&n[o].push([t,e,i]);}function c(t,e){for(var r;t[e].length;)(r=t[e].shift())[0][r[1]]=r[2];}function l(t,e,r,o,i){this.options=t;var s=t.autoInstrument;!1===t.enabled||!1===s?this.autoInstrument={}:(n.isType(s,"object")||(s=a),this.autoInstrument=n.merge(a,s)),this.scrubTelemetryInputs=!!t.scrubTelemetryInputs,this.telemetryScrubber=t.telemetryScrubber,this.defaultValueScrubber=function(t){for(var e=[],r=0;r<t.length;++r)e.push(new RegExp(t[r],"i"));return function(t){var r=function(t){if(!t||!t.attributes)return null;for(var e=t.attributes,r=0;r<e.length;++r)if("name"===e[r].key)return e[r].value;return null}(t);if(!r)return !1;for(var n=0;n<e.length;++n)if(e[n].test(r))return !0;return !1}}(t.scrubFields),this.telemeter=e,this.rollbar=r,this.diagnostic=r.client.notifier.diagnostic,this._window=o||{},this._document=i||{},this.replacements={network:[],log:[],navigation:[],connectivity:[]},this.eventRemovers={dom:[],connectivity:[],contentsecuritypolicy:[]},this._location=this._window.location,this._lastHref=this._location&&this._location.href;}l.prototype.configure=function(t){this.options=n.merge(this.options,t);var e=t.autoInstrument,r=n.merge(this.autoInstrument);!1===t.enabled||!1===e?this.autoInstrument={}:(n.isType(e,"object")||(e=a),this.autoInstrument=n.merge(a,e)),this.instrument(r),void 0!==t.scrubTelemetryInputs&&(this.scrubTelemetryInputs=!!t.scrubTelemetryInputs),void 0!==t.telemetryScrubber&&(this.telemetryScrubber=t.telemetryScrubber);},l.prototype.instrument=function(t){!this.autoInstrument.network||t&&t.network?!this.autoInstrument.network&&t&&t.network&&this.deinstrumentNetwork():this.instrumentNetwork(),!this.autoInstrument.log||t&&t.log?!this.autoInstrument.log&&t&&t.log&&this.deinstrumentConsole():this.instrumentConsole(),!this.autoInstrument.dom||t&&t.dom?!this.autoInstrument.dom&&t&&t.dom&&this.deinstrumentDom():this.instrumentDom(),!this.autoInstrument.navigation||t&&t.navigation?!this.autoInstrument.navigation&&t&&t.navigation&&this.deinstrumentNavigation():this.instrumentNavigation(),!this.autoInstrument.connectivity||t&&t.connectivity?!this.autoInstrument.connectivity&&t&&t.connectivity&&this.deinstrumentConnectivity():this.instrumentConnectivity(),!this.autoInstrument.contentSecurityPolicy||t&&t.contentSecurityPolicy?!this.autoInstrument.contentSecurityPolicy&&t&&t.contentSecurityPolicy&&this.deinstrumentContentSecurityPolicy():this.instrumentContentSecurityPolicy();},l.prototype.deinstrumentNetwork=function(){c(this.replacements,"network");},l.prototype.instrumentNetwork=function(){var t=this;function e(e,r){e in r&&n.isFunction(r[e])&&u(r,e,(function(e){return t.rollbar.wrap(e)}));}if("XMLHttpRequest"in this._window){var r=this._window.XMLHttpRequest.prototype;u(r,"open",(function(t){return function(e,r){return n.isType(r,"string")&&(this.__rollbar_xhr?(this.__rollbar_xhr.method=e,this.__rollbar_xhr.url=r,this.__rollbar_xhr.status_code=null,this.__rollbar_xhr.start_time_ms=n.now(),this.__rollbar_xhr.end_time_ms=null):this.__rollbar_xhr={method:e,url:r,status_code:null,start_time_ms:n.now(),end_time_ms:null}),t.apply(this,arguments)}}),this.replacements,"network"),u(r,"setRequestHeader",(function(e){return function(r,o){return this.__rollbar_xhr||(this.__rollbar_xhr={}),n.isType(r,"string")&&n.isType(o,"string")&&(t.autoInstrument.networkRequestHeaders&&(this.__rollbar_xhr.request_headers||(this.__rollbar_xhr.request_headers={}),this.__rollbar_xhr.request_headers[r]=o),"content-type"===r.toLowerCase()&&(this.__rollbar_xhr.request_content_type=o)),e.apply(this,arguments)}}),this.replacements,"network"),u(r,"send",(function(r){return function(o){var i=this;function s(){if(i.__rollbar_xhr&&(null===i.__rollbar_xhr.status_code&&(i.__rollbar_xhr.status_code=0,t.autoInstrument.networkRequestBody&&(i.__rollbar_xhr.request=o),i.__rollbar_event=t.captureNetwork(i.__rollbar_xhr,"xhr",void 0)),i.readyState<2&&(i.__rollbar_xhr.start_time_ms=n.now()),i.readyState>3)){i.__rollbar_xhr.end_time_ms=n.now();var e=null;if(i.__rollbar_xhr.response_content_type=i.getResponseHeader("Content-Type"),t.autoInstrument.networkResponseHeaders){var r=t.autoInstrument.networkResponseHeaders;e={};try{var s,a;if(!0===r){var u=i.getAllResponseHeaders();if(u){var c,l,p=u.trim().split(/[\r\n]+/);for(a=0;a<p.length;a++)s=(c=p[a].split(": ")).shift(),l=c.join(": "),e[s]=l;}}else for(a=0;a<r.length;a++)e[s=r[a]]=i.getResponseHeader(s);}catch(t){}}var f=null;if(t.autoInstrument.networkResponseBody)try{f=i.responseText;}catch(t){}var h=null;(f||e)&&(h={},f&&(t.isJsonContentType(i.__rollbar_xhr.response_content_type)?h.body=t.scrubJson(f):h.body=f),e&&(h.headers=e)),h&&(i.__rollbar_xhr.response=h);try{var d=i.status;d=1223===d?204:d,i.__rollbar_xhr.status_code=d,i.__rollbar_event.level=t.telemeter.levelFromStatus(d),t.errorOnHttpStatus(i.__rollbar_xhr);}catch(t){}}}return e("onload",i),e("onerror",i),e("onprogress",i),"onreadystatechange"in i&&n.isFunction(i.onreadystatechange)?u(i,"onreadystatechange",(function(e){return t.rollbar.wrap(e,void 0,s)})):i.onreadystatechange=s,i.__rollbar_xhr&&t.trackHttpErrors()&&(i.__rollbar_xhr.stack=(new Error).stack),r.apply(this,arguments)}}),this.replacements,"network");}"fetch"in this._window&&u(this._window,"fetch",(function(e){return function(r,o){for(var i=new Array(arguments.length),s=0,a=i.length;s<a;s++)i[s]=arguments[s];var u,c=i[0],l="GET";n.isType(c,"string")?u=c:c&&(u=c.url,c.method&&(l=c.method)),i[1]&&i[1].method&&(l=i[1].method);var p={method:l,url:u,status_code:null,start_time_ms:n.now(),end_time_ms:null};if(i[1]&&i[1].headers){var f=new Headers(i[1].headers);p.request_content_type=f.get("Content-Type"),t.autoInstrument.networkRequestHeaders&&(p.request_headers=t.fetchHeaders(f,t.autoInstrument.networkRequestHeaders));}return t.autoInstrument.networkRequestBody&&(i[1]&&i[1].body?p.request=i[1].body:i[0]&&!n.isType(i[0],"string")&&i[0].body&&(p.request=i[0].body)),t.captureNetwork(p,"fetch",void 0),t.trackHttpErrors()&&(p.stack=(new Error).stack),e.apply(this,i).then((function(e){p.end_time_ms=n.now(),p.status_code=e.status,p.response_content_type=e.headers.get("Content-Type");var r=null;t.autoInstrument.networkResponseHeaders&&(r=t.fetchHeaders(e.headers,t.autoInstrument.networkResponseHeaders));var o=null;return t.autoInstrument.networkResponseBody&&"function"==typeof e.text&&(o=e.clone().text()),(r||o)&&(p.response={},o&&("function"==typeof o.then?o.then((function(e){t.isJsonContentType(p.response_content_type)&&(p.response.body=t.scrubJson(e));})):p.response.body=o),r&&(p.response.headers=r)),t.errorOnHttpStatus(p),e}))}}),this.replacements,"network");},l.prototype.captureNetwork=function(t,e,r){return t.request&&this.isJsonContentType(t.request_content_type)&&(t.request=this.scrubJson(t.request)),this.telemeter.captureNetwork(t,e,r)},l.prototype.isJsonContentType=function(t){return !!(t&&n.isType(t,"string")&&t.toLowerCase().includes("json"))},l.prototype.scrubJson=function(t){return JSON.stringify(o(JSON.parse(t),this.options.scrubFields))},l.prototype.fetchHeaders=function(t,e){var r={};try{var n;if(!0===e){if("function"==typeof t.entries)for(var o=t.entries(),i=o.next();!i.done;)r[i.value[0]]=i.value[1],i=o.next();}else for(n=0;n<e.length;n++){var s=e[n];r[s]=t.get(s);}}catch(t){}return r},l.prototype.trackHttpErrors=function(){return this.autoInstrument.networkErrorOnHttp5xx||this.autoInstrument.networkErrorOnHttp4xx||this.autoInstrument.networkErrorOnHttp0},l.prototype.errorOnHttpStatus=function(t){var e=t.status_code;if(e>=500&&this.autoInstrument.networkErrorOnHttp5xx||e>=400&&this.autoInstrument.networkErrorOnHttp4xx||0===e&&this.autoInstrument.networkErrorOnHttp0){var r=new Error("HTTP request failed with Status "+e);r.stack=t.stack,this.rollbar.error(r,{skipFrames:1});}},l.prototype.deinstrumentConsole=function(){if("console"in this._window&&this._window.console.log)for(var t;this.replacements.log.length;)t=this.replacements.log.shift(),this._window.console[t[0]]=t[1];},l.prototype.instrumentConsole=function(){if("console"in this._window&&this._window.console.log){var t=this,e=this._window.console,r=["debug","info","warn","error","log"];try{for(var o=0,i=r.length;o<i;o++)s(r[o]);}catch(t){this.diagnostic.instrumentConsole={error:t.message};}}function s(r){var o=e[r],i=e,s="warn"===r?"warning":r;e[r]=function(){var e=Array.prototype.slice.call(arguments),r=n.formatArgsAsString(e);t.telemeter.captureLog(r,s),o&&Function.prototype.apply.call(o,i,e);},t.replacements.log.push([r,o]);}},l.prototype.deinstrumentDom=function(){("addEventListener"in this._window||"attachEvent"in this._window)&&this.removeListeners("dom");},l.prototype.instrumentDom=function(){if("addEventListener"in this._window||"attachEvent"in this._window){var t=this.handleClick.bind(this),e=this.handleBlur.bind(this);this.addListener("dom",this._window,"click","onclick",t,!0),this.addListener("dom",this._window,"blur","onfocusout",e,!0);}},l.prototype.handleClick=function(t){try{var e=s.getElementFromEvent(t,this._document),r=e&&e.tagName,n=s.isDescribedElement(e,"a")||s.isDescribedElement(e,"button");r&&(n||s.isDescribedElement(e,"input",["button","submit"]))?this.captureDomEvent("click",e):s.isDescribedElement(e,"input",["checkbox","radio"])&&this.captureDomEvent("input",e,e.value,e.checked);}catch(t){}},l.prototype.handleBlur=function(t){try{var e=s.getElementFromEvent(t,this._document);e&&e.tagName&&(s.isDescribedElement(e,"textarea")?this.captureDomEvent("input",e,e.value):s.isDescribedElement(e,"select")&&e.options&&e.options.length?this.handleSelectInputChanged(e):s.isDescribedElement(e,"input")&&!s.isDescribedElement(e,"input",["button","submit","hidden","checkbox","radio"])&&this.captureDomEvent("input",e,e.value));}catch(t){}},l.prototype.handleSelectInputChanged=function(t){if(t.multiple)for(var e=0;e<t.options.length;e++)t.options[e].selected&&this.captureDomEvent("input",t,t.options[e].value);else t.selectedIndex>=0&&t.options[t.selectedIndex]&&this.captureDomEvent("input",t,t.options[t.selectedIndex].value);},l.prototype.captureDomEvent=function(t,e,r,n){if(void 0!==r)if(this.scrubTelemetryInputs||"password"===s.getElementType(e))r="[scrubbed]";else {var o=s.describeElement(e);this.telemetryScrubber?this.telemetryScrubber(o)&&(r="[scrubbed]"):this.defaultValueScrubber(o)&&(r="[scrubbed]");}var i=s.elementArrayToString(s.treeToArray(e));this.telemeter.captureDom(t,i,r,n);},l.prototype.deinstrumentNavigation=function(){var t=this._window.chrome;!(t&&t.app&&t.app.runtime)&&this._window.history&&this._window.history.pushState&&c(this.replacements,"navigation");},l.prototype.instrumentNavigation=function(){var t=this._window.chrome;if(!(t&&t.app&&t.app.runtime)&&this._window.history&&this._window.history.pushState){var e=this;u(this._window,"onpopstate",(function(t){return function(){var r=e._location.href;e.handleUrlChange(e._lastHref,r),t&&t.apply(this,arguments);}}),this.replacements,"navigation"),u(this._window.history,"pushState",(function(t){return function(){var r=arguments.length>2?arguments[2]:void 0;return r&&e.handleUrlChange(e._lastHref,r+""),t.apply(this,arguments)}}),this.replacements,"navigation");}},l.prototype.handleUrlChange=function(t,e){var r=i.parse(this._location.href),n=i.parse(e),o=i.parse(t);this._lastHref=e,r.protocol===n.protocol&&r.host===n.host&&(e=n.path+(n.hash||"")),r.protocol===o.protocol&&r.host===o.host&&(t=o.path+(o.hash||"")),this.telemeter.captureNavigation(t,e);},l.prototype.deinstrumentConnectivity=function(){("addEventListener"in this._window||"body"in this._document)&&(this._window.addEventListener?this.removeListeners("connectivity"):c(this.replacements,"connectivity"));},l.prototype.instrumentConnectivity=function(){if("addEventListener"in this._window||"body"in this._document)if(this._window.addEventListener)this.addListener("connectivity",this._window,"online",void 0,function(){this.telemeter.captureConnectivityChange("online");}.bind(this),!0),this.addListener("connectivity",this._window,"offline",void 0,function(){this.telemeter.captureConnectivityChange("offline");}.bind(this),!0);else {var t=this;u(this._document.body,"ononline",(function(e){return function(){t.telemeter.captureConnectivityChange("online"),e&&e.apply(this,arguments);}}),this.replacements,"connectivity"),u(this._document.body,"onoffline",(function(e){return function(){t.telemeter.captureConnectivityChange("offline"),e&&e.apply(this,arguments);}}),this.replacements,"connectivity");}},l.prototype.handleCspEvent=function(t){var e="Security Policy Violation: blockedURI: "+t.blockedURI+", violatedDirective: "+t.violatedDirective+", effectiveDirective: "+t.effectiveDirective+", ";t.sourceFile&&(e+="location: "+t.sourceFile+", line: "+t.lineNumber+", col: "+t.columnNumber+", "),e+="originalPolicy: "+t.originalPolicy,this.telemeter.captureLog(e,"error"),this.handleCspError(e);},l.prototype.handleCspError=function(t){this.autoInstrument.errorOnContentSecurityPolicy&&this.rollbar.error(t);},l.prototype.deinstrumentContentSecurityPolicy=function(){"addEventListener"in this._window&&this.removeListeners("contentsecuritypolicy");},l.prototype.instrumentContentSecurityPolicy=function(){if("addEventListener"in this._window){var t=this.handleCspEvent.bind(this);this.addListener("contentsecuritypolicy",this._window,"securitypolicyviolation",null,t,!1);}},l.prototype.addListener=function(t,e,r,n,o,i){e.addEventListener?(e.addEventListener(r,o,i),this.eventRemovers[t].push((function(){e.removeEventListener(r,o,i);}))):n&&(e.attachEvent(n,o),this.eventRemovers[t].push((function(){e.detachEvent(n,o);})));},l.prototype.removeListeners=function(t){for(;this.eventRemovers[t].length;)this.eventRemovers[t].shift()();},t.exports=l;},function(t,e,r){function n(t){return (t.getAttribute("type")||"").toLowerCase()}function o(t){if(!t||!t.tagName)return "";var e=[t.tagName];t.id&&e.push("#"+t.id),t.classes&&e.push("."+t.classes.join("."));for(var r=0;r<t.attributes.length;r++)e.push("["+t.attributes[r].key+'="'+t.attributes[r].value+'"]');return e.join("")}function i(t){if(!t||!t.tagName)return null;var e,r,n,o,i={};i.tagName=t.tagName.toLowerCase(),t.id&&(i.id=t.id),(e=t.className)&&"string"==typeof e&&(i.classes=e.split(/\s+/));var s=["type","name","title","alt"];for(i.attributes=[],o=0;o<s.length;o++)r=s[o],(n=t.getAttribute(r))&&i.attributes.push({key:r,value:n});return i}t.exports={describeElement:i,descriptionToString:o,elementArrayToString:function(t){for(var e,r,n=" > ".length,i=[],s=0,a=t.length-1;a>=0;a--){if(e=o(t[a]),r=s+i.length*n+e.length,a<t.length-1&&r>=83){i.unshift("...");break}i.unshift(e),s+=e.length;}return i.join(" > ")},treeToArray:function(t){for(var e,r=[],n=0;t&&n<5&&"html"!==(e=i(t)).tagName;n++)r.unshift(e),t=t.parentNode;return r},getElementFromEvent:function(t,e){return t.target?t.target:e&&e.elementFromPoint?e.elementFromPoint(t.clientX,t.clientY):void 0},isDescribedElement:function(t,e,r){if(t.tagName.toLowerCase()!==e.toLowerCase())return !1;if(!r)return !0;t=n(t);for(var o=0;o<r.length;o++)if(r[o]===t)return !0;return !1},getElementType:n};},function(t,e,r){var n=r(33);t.exports=n;},function(t,e){t.exports=function(t){var e,r,n,o,i,s,a,u,c,l,p,f,h,d=/[\\"\u0000-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;function m(t){return t<10?"0"+t:t}function g(){return this.valueOf()}function v(t){return d.lastIndex=0,d.test(t)?'"'+t.replace(d,(function(t){var e=n[t];return "string"==typeof e?e:"\\u"+("0000"+t.charCodeAt(0).toString(16)).slice(-4)}))+'"':'"'+t+'"'}"function"!=typeof Date.prototype.toJSON&&(Date.prototype.toJSON=function(){return isFinite(this.valueOf())?this.getUTCFullYear()+"-"+m(this.getUTCMonth()+1)+"-"+m(this.getUTCDate())+"T"+m(this.getUTCHours())+":"+m(this.getUTCMinutes())+":"+m(this.getUTCSeconds())+"Z":null},Boolean.prototype.toJSON=g,Number.prototype.toJSON=g,String.prototype.toJSON=g),"function"!=typeof t.stringify&&(n={"\b":"\\b","\t":"\\t","\n":"\\n","\f":"\\f","\r":"\\r",'"':'\\"',"\\":"\\\\"},t.stringify=function(t,n,i){var s;if(e="",r="","number"==typeof i)for(s=0;s<i;s+=1)r+=" ";else "string"==typeof i&&(r=i);if(o=n,n&&"function"!=typeof n&&("object"!=typeof n||"number"!=typeof n.length))throw new Error("JSON.stringify");return function t(n,i){var s,a,u,c,l,p=e,f=i[n];switch(f&&"object"==typeof f&&"function"==typeof f.toJSON&&(f=f.toJSON(n)),"function"==typeof o&&(f=o.call(i,n,f)),typeof f){case"string":return v(f);case"number":return isFinite(f)?String(f):"null";case"boolean":case"null":return String(f);case"object":if(!f)return "null";if(e+=r,l=[],"[object Array]"===Object.prototype.toString.apply(f)){for(c=f.length,s=0;s<c;s+=1)l[s]=t(s,f)||"null";return u=0===l.length?"[]":e?"[\n"+e+l.join(",\n"+e)+"\n"+p+"]":"["+l.join(",")+"]",e=p,u}if(o&&"object"==typeof o)for(c=o.length,s=0;s<c;s+=1)"string"==typeof o[s]&&(u=t(a=o[s],f))&&l.push(v(a)+(e?": ":":")+u);else for(a in f)Object.prototype.hasOwnProperty.call(f,a)&&(u=t(a,f))&&l.push(v(a)+(e?": ":":")+u);return u=0===l.length?"{}":e?"{\n"+e+l.join(",\n"+e)+"\n"+p+"}":"{"+l.join(",")+"}",e=p,u}}("",{"":t})}),"function"!=typeof t.parse&&(t.parse=(l={"\\":"\\",'"':'"',"/":"/",t:"\t",n:"\n",r:"\r",f:"\f",b:"\b"},p={go:function(){i="ok";},firstokey:function(){u=c,i="colon";},okey:function(){u=c,i="colon";},ovalue:function(){i="ocomma";},firstavalue:function(){i="acomma";},avalue:function(){i="acomma";}},f={go:function(){i="ok";},ovalue:function(){i="ocomma";},firstavalue:function(){i="acomma";},avalue:function(){i="acomma";}},h={"{":{go:function(){s.push({state:"ok"}),a={},i="firstokey";},ovalue:function(){s.push({container:a,state:"ocomma",key:u}),a={},i="firstokey";},firstavalue:function(){s.push({container:a,state:"acomma"}),a={},i="firstokey";},avalue:function(){s.push({container:a,state:"acomma"}),a={},i="firstokey";}},"}":{firstokey:function(){var t=s.pop();c=a,a=t.container,u=t.key,i=t.state;},ocomma:function(){var t=s.pop();a[u]=c,c=a,a=t.container,u=t.key,i=t.state;}},"[":{go:function(){s.push({state:"ok"}),a=[],i="firstavalue";},ovalue:function(){s.push({container:a,state:"ocomma",key:u}),a=[],i="firstavalue";},firstavalue:function(){s.push({container:a,state:"acomma"}),a=[],i="firstavalue";},avalue:function(){s.push({container:a,state:"acomma"}),a=[],i="firstavalue";}},"]":{firstavalue:function(){var t=s.pop();c=a,a=t.container,u=t.key,i=t.state;},acomma:function(){var t=s.pop();a.push(c),c=a,a=t.container,u=t.key,i=t.state;}},":":{colon:function(){if(Object.hasOwnProperty.call(a,u))throw new SyntaxError("Duplicate key '"+u+'"');i="ovalue";}},",":{ocomma:function(){a[u]=c,i="okey";},acomma:function(){a.push(c),i="avalue";}},true:{go:function(){c=!0,i="ok";},ovalue:function(){c=!0,i="ocomma";},firstavalue:function(){c=!0,i="acomma";},avalue:function(){c=!0,i="acomma";}},false:{go:function(){c=!1,i="ok";},ovalue:function(){c=!1,i="ocomma";},firstavalue:function(){c=!1,i="acomma";},avalue:function(){c=!1,i="acomma";}},null:{go:function(){c=null,i="ok";},ovalue:function(){c=null,i="ocomma";},firstavalue:function(){c=null,i="acomma";},avalue:function(){c=null,i="acomma";}}},function(t,e){var r,n,o=/^[\u0020\t\n\r]*(?:([,:\[\]{}]|true|false|null)|(-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)|"((?:[^\r\n\t\\\"]|\\(?:["\\\/trnfb]|u[0-9a-fA-F]{4}))*)")/;i="go",s=[];try{for(;r=o.exec(t);)r[1]?h[r[1]][i]():r[2]?(c=+r[2],f[i]()):(n=r[3],c=n.replace(/\\(?:u(.{4})|([^u]))/g,(function(t,e,r){return e?String.fromCharCode(parseInt(e,16)):l[r]})),p[i]()),t=t.slice(r[0].length);}catch(t){i=t;}if("ok"!==i||/[^\u0020\t\n\r]/.test(t))throw i instanceof SyntaxError?i:new SyntaxError("JSON");return "function"==typeof e?function t(r,n){var o,i,s=r[n];if(s&&"object"==typeof s)for(o in c)Object.prototype.hasOwnProperty.call(s,o)&&(void 0!==(i=t(s,o))?s[o]=i:delete s[o]);return e.call(r,n,s)}({"":c},""):c}));};},function(t,e,r){function n(t,e,r){if(e.hasOwnProperty&&e.hasOwnProperty("addEventListener")){for(var n=e.addEventListener;n._rollbarOldAdd&&n.belongsToShim;)n=n._rollbarOldAdd;var o=function(e,r,o){n.call(this,e,t.wrap(r),o);};o._rollbarOldAdd=n,o.belongsToShim=r,e.addEventListener=o;for(var i=e.removeEventListener;i._rollbarOldRemove&&i.belongsToShim;)i=i._rollbarOldRemove;var s=function(t,e,r){i.call(this,t,e&&e._rollbar_wrapped||e,r);};s._rollbarOldRemove=i,s.belongsToShim=r,e.removeEventListener=s;}}t.exports=function(t,e,r){if(t){var o,i,s="EventTarget,Window,Node,ApplicationCache,AudioTrackList,ChannelMergerNode,CryptoOperation,EventSource,FileReader,HTMLUnknownElement,IDBDatabase,IDBRequest,IDBTransaction,KeyOperation,MediaController,MessagePort,ModalWindow,Notification,SVGElementInstance,Screen,TextTrack,TextTrackCue,TextTrackList,WebSocket,WebSocketWorker,Worker,XMLHttpRequest,XMLHttpRequestEventTarget,XMLHttpRequestUpload".split(",");for(o=0;o<s.length;++o)t[i=s[o]]&&t[i].prototype&&n(e,t[i].prototype,r);}};},function(t,e,r){var n=r(0),o=r(5);function i(t,e){return [t,n.stringify(t,e)]}function s(t,e){var r=t.length;return r>2*e?t.slice(0,e).concat(t.slice(r-e)):t}function a(t,e,r){r=void 0===r?30:r;var o,i=t.data.body;if(i.trace_chain)for(var a=i.trace_chain,u=0;u<a.length;u++)o=s(o=a[u].frames,r),a[u].frames=o;else i.trace&&(o=s(o=i.trace.frames,r),i.trace.frames=o);return [t,n.stringify(t,e)]}function u(t,e){return e&&e.length>t?e.slice(0,t-3).concat("..."):e}function c(t,e,r){return [e=o(e,(function e(r,i,s){switch(n.typeName(i)){case"string":return u(t,i);case"object":case"array":return o(i,e,s);default:return i}})),n.stringify(e,r)]}function l(t){return t.exception&&(delete t.exception.description,t.exception.message=u(255,t.exception.message)),t.frames=s(t.frames,1),t}function p(t,e){var r=t.data.body;if(r.trace_chain)for(var o=r.trace_chain,i=0;i<o.length;i++)o[i]=l(o[i]);else r.trace&&(r.trace=l(r.trace));return [t,n.stringify(t,e)]}function f(t,e){return n.maxByteSize(t)>e}t.exports={truncate:function(t,e,r){r=void 0===r?524288:r;for(var n,o,s,u=[i,a,c.bind(null,1024),c.bind(null,512),c.bind(null,256),p];n=u.shift();)if(t=(o=n(t,e))[0],(s=o[1]).error||!f(s.value,r))return s;return s},raw:i,truncateFrames:a,truncateStrings:c,maybeTruncateValue:u};}])}));

    });

    var Rollbar = /*@__PURE__*/getDefaultExportFromCjs(rollbar_umd_min);

    const rollbar = Rollbar.init({
        accessToken: "process.env.ROLLBAR_ACCESS_TOKEN",
        captureUncaught: true,
        autoInstrument: false,
        logLevel: "error",
        captureUnhandledRejections: true,
        payload: {
            environment: "process.env.ROLLBAR_ENV",
        },
    });

    function openMessageCache() {
        try {
            return openDB("openchat_db", 8, {
                upgrade(db, _oldVersion, _newVersion) {
                    try {
                        if (db.objectStoreNames.contains("chat_messages")) {
                            db.deleteObjectStore("chat_messages");
                        }
                        if (db.objectStoreNames.contains("media_data")) {
                            db.deleteObjectStore("media_data");
                        }
                        if (db.objectStoreNames.contains("chats")) {
                            db.deleteObjectStore("chats");
                        }
                        db.createObjectStore("chat_messages");
                        db.createObjectStore("chats");
                        if (!db.objectStoreNames.contains("soft_disabled")) {
                            db.createObjectStore("soft_disabled");
                        }
                    }
                    catch (err) {
                        rollbar.error("Unable to upgrade indexDB", err);
                    }
                },
            });
        }
        catch (err) {
            rollbar.error("Unable to open indexDB", err);
        }
    }
    async function getSoftDisabled() {
        if (db !== undefined) {
            const res = await (await db).get("soft_disabled", "soft_disabled");
            return res !== null && res !== void 0 ? res : false;
        }
        return false;
    }
    const db = openMessageCache();

    self.addEventListener("install", function (_event) {
        self.skipWaiting();
    });
    self.addEventListener("push", function (event) {
        event.waitUntil(handlePushNotification(event));
    });
    self.addEventListener("notificationclick", function (event) {
        event.waitUntil(handleNotificationClick(event));
    });
    self.addEventListener("fetch", () => {
        console.log("dummy fetch interceptor");
    });
    async function handlePushNotification(event) {
        var _a;
        if (await getSoftDisabled())
            return;
        // Try to extract the typed notification from the event
        const candid = (_a = event.data) === null || _a === void 0 ? void 0 : _a.json();
        if (!candid) {
            return;
        }
        // If an OC browser window already has the focus then don't show a notification
        if (await isClientFocused()) {
            return;
        }
        await showNotification(notification(candid));
    }
    async function handleNotificationClick(event) {
        event.notification.close();
        const windowClients = await self.clients.matchAll({
            type: "window",
            includeUncontrolled: true,
        });
        if (windowClients.length > 0) {
            const window = windowClients[0];
            window.focus();
            window.postMessage({
                type: "NOTIFICATION_CLICKED",
                chatId: event.notification.data.chatId,
                messageId: event.notification.data.messageId,
            });
        }
        else {
            const urlToOpen = new URL(self.location.origin).href + event.notification.data.chatId;
            await self.clients.openWindow(urlToOpen);
        }
    }
    async function isClientFocused() {
        const windowClients = await self.clients.matchAll({
            type: "window",
            includeUncontrolled: true,
        });
        return windowClients.some((wc) => wc.focused);
    }
    async function showNotification(notification) {
        var _a, _b;
        let icon = "/_/raw/icon.png";
        let title = "OpenChat - ";
        let body;
        let sender;
        let messageId;
        let chatId = "";
        if (notification.kind === "direct_notification") {
            const content = extractMessageContent(notification.message.content);
            title += notification.senderName;
            body = content.text;
            icon = (_a = content.image) !== null && _a !== void 0 ? _a : icon;
            sender = notification.sender;
            chatId = notification.sender;
            messageId = notification.message.messageId;
        }
        else if (notification.kind === "group_notification") {
            const content = extractMessageContent(notification.message.content);
            title += notification.groupName;
            body = `${notification.senderName}: ${content.text}`;
            icon = (_b = content.image) !== null && _b !== void 0 ? _b : icon;
            sender = notification.sender;
            chatId = notification.chatId;
            messageId = notification.message.messageId;
        }
        else {
            console.log("Unexpected notification type");
            return;
        }
        await self.registration.showNotification(title, {
            body,
            icon,
            tag: chatId,
            data: {
                chatId,
                sender,
                messageId,
            },
        });
    }
    function extractMessageContent(content) {
        var _a, _b, _c, _d;
        if (content.kind === "text_content") {
            return {
                text: content.text,
            };
        }
        else if (content.kind === "image_content") {
            return {
                text: (_a = content.caption) !== null && _a !== void 0 ? _a : extractMediaType(content.mimeType),
                image: content.thumbnailData,
            };
        }
        else if (content.kind === "video_content") {
            return {
                text: (_b = content.caption) !== null && _b !== void 0 ? _b : extractMediaType(content.mimeType),
                image: content.thumbnailData,
            };
        }
        else if (content.kind === "audio_content") {
            return {
                text: (_c = content.caption) !== null && _c !== void 0 ? _c : extractMediaType(content.mimeType),
            };
        }
        else if (content.kind === "file_content") {
            return {
                text: (_d = content.caption) !== null && _d !== void 0 ? _d : content.mimeType,
                image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAABmJLR0QA/wD/AP+gvaeTAAAA30lEQVRoge2ZMQ6CQBBFn8baA2jNPS09ig29dyIWcAEtxMRY6Cw7O6Pmv2QLEpj/X4YKQAhhoQN6YAKulecQ3J0OuDgUT5PoncuHS3i8NqkSr6Fecx7nWFuwNNhrTphEhEBTiSiBZhKRAk0kogXcJTIEXCWyBEwSK2Nw6TOWOVbe5q0XDv0aNoFZ1s0VbernNyCBbCSQjQSykUA2EshGAtlIIBsJZCOBbCSQjeWrxARsn65rPm6VMn66wbKBs0ORpbhk74GB+t9JpWcAdh4CzINO3Ffauvg4Z7mVF+KfuQEADATf0SgDdQAAAABJRU5ErkJggg==",
            };
        }
        else if (content.kind === "cycles_content") {
            return {
                text: "TODO - cycles content",
            };
        }
        else if (content.kind === "deleted_content") {
            return {
                text: "TODO - deleted content",
            };
        }
        else if (content.kind === "placeholder_content") {
            return {
                text: "TODO - placeholder content",
            };
        }
        throw new UnsupportedValueError("Unexpected message content type received with notification", content);
    }
    function extractMediaType(mimeType) {
        return mimeType.replace(/\/.*/, "");
    }

}());
//# sourceMappingURL=sw.js.map
