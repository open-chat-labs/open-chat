(function () {
    'use strict';

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
    /**
     * @param input The input array to encode.
     * @returns A Base32 string encoding the input.
     */
    function encode(input) {
        // How many bits will we skip from the first byte.
        let skip = 0;
        // 5 high bits, carry from one byte to the next.
        let bits = 0;
        // The output string in base32.
        let output = '';
        function encodeByte(byte) {
            if (skip < 0) {
                // we have a carry from the previous byte
                bits |= byte >> -skip;
            }
            else {
                // no carry
                bits = (byte << skip) & 248;
            }
            if (skip > 3) {
                // Not enough data to produce a character, get us another one
                skip -= 8;
                return 1;
            }
            if (skip < 4) {
                // produce a character
                output += alphabet[bits >> 3];
                skip += 5;
            }
            return 0;
        }
        for (let i = 0; i < input.length;) {
            i += encodeByte(input[i]);
        }
        return output + (skip < 0 ? alphabet[bits >> 3] : '');
    }
    /**
     * @param input The base32 encoded string to decode.
     */
    function decode$1(input) {
        // how many bits we have from the previous character.
        let skip = 0;
        // current byte we're producing.
        let byte = 0;
        const output = new Uint8Array(((input.length * 4) / 3) | 0);
        let o = 0;
        function decodeChar(char) {
            // Consume a character from the stream, store
            // the output in this.output. As before, better
            // to use update().
            let val = lookupTable[char.toLowerCase()];
            if (val === undefined) {
                throw new Error(`Invalid character: ${JSON.stringify(char)}`);
            }
            // move to the high bits
            val <<= 3;
            byte |= val >>> skip;
            skip += 5;
            if (skip >= 8) {
                // We have enough bytes to produce an output
                output[o++] = byte;
                skip -= 8;
                if (skip > 0) {
                    byte = (val << (5 - skip)) & 255;
                }
                else {
                    byte = 0;
                }
            }
        }
        for (const c of input) {
            decodeChar(c);
        }
        return output.slice(0, o);
    }

    // tslint:disable:no-bitwise
    // This file is translated to JavaScript from
    // https://lxp32.github.io/docs/a-simple-example-crc32-calculation/
    const lookUpTable = new Uint32Array([
        0x00000000, 0x77073096, 0xee0e612c, 0x990951ba, 0x076dc419, 0x706af48f, 0xe963a535, 0x9e6495a3,
        0x0edb8832, 0x79dcb8a4, 0xe0d5e91e, 0x97d2d988, 0x09b64c2b, 0x7eb17cbd, 0xe7b82d07, 0x90bf1d91,
        0x1db71064, 0x6ab020f2, 0xf3b97148, 0x84be41de, 0x1adad47d, 0x6ddde4eb, 0xf4d4b551, 0x83d385c7,
        0x136c9856, 0x646ba8c0, 0xfd62f97a, 0x8a65c9ec, 0x14015c4f, 0x63066cd9, 0xfa0f3d63, 0x8d080df5,
        0x3b6e20c8, 0x4c69105e, 0xd56041e4, 0xa2677172, 0x3c03e4d1, 0x4b04d447, 0xd20d85fd, 0xa50ab56b,
        0x35b5a8fa, 0x42b2986c, 0xdbbbc9d6, 0xacbcf940, 0x32d86ce3, 0x45df5c75, 0xdcd60dcf, 0xabd13d59,
        0x26d930ac, 0x51de003a, 0xc8d75180, 0xbfd06116, 0x21b4f4b5, 0x56b3c423, 0xcfba9599, 0xb8bda50f,
        0x2802b89e, 0x5f058808, 0xc60cd9b2, 0xb10be924, 0x2f6f7c87, 0x58684c11, 0xc1611dab, 0xb6662d3d,
        0x76dc4190, 0x01db7106, 0x98d220bc, 0xefd5102a, 0x71b18589, 0x06b6b51f, 0x9fbfe4a5, 0xe8b8d433,
        0x7807c9a2, 0x0f00f934, 0x9609a88e, 0xe10e9818, 0x7f6a0dbb, 0x086d3d2d, 0x91646c97, 0xe6635c01,
        0x6b6b51f4, 0x1c6c6162, 0x856530d8, 0xf262004e, 0x6c0695ed, 0x1b01a57b, 0x8208f4c1, 0xf50fc457,
        0x65b0d9c6, 0x12b7e950, 0x8bbeb8ea, 0xfcb9887c, 0x62dd1ddf, 0x15da2d49, 0x8cd37cf3, 0xfbd44c65,
        0x4db26158, 0x3ab551ce, 0xa3bc0074, 0xd4bb30e2, 0x4adfa541, 0x3dd895d7, 0xa4d1c46d, 0xd3d6f4fb,
        0x4369e96a, 0x346ed9fc, 0xad678846, 0xda60b8d0, 0x44042d73, 0x33031de5, 0xaa0a4c5f, 0xdd0d7cc9,
        0x5005713c, 0x270241aa, 0xbe0b1010, 0xc90c2086, 0x5768b525, 0x206f85b3, 0xb966d409, 0xce61e49f,
        0x5edef90e, 0x29d9c998, 0xb0d09822, 0xc7d7a8b4, 0x59b33d17, 0x2eb40d81, 0xb7bd5c3b, 0xc0ba6cad,
        0xedb88320, 0x9abfb3b6, 0x03b6e20c, 0x74b1d29a, 0xead54739, 0x9dd277af, 0x04db2615, 0x73dc1683,
        0xe3630b12, 0x94643b84, 0x0d6d6a3e, 0x7a6a5aa8, 0xe40ecf0b, 0x9309ff9d, 0x0a00ae27, 0x7d079eb1,
        0xf00f9344, 0x8708a3d2, 0x1e01f268, 0x6906c2fe, 0xf762575d, 0x806567cb, 0x196c3671, 0x6e6b06e7,
        0xfed41b76, 0x89d32be0, 0x10da7a5a, 0x67dd4acc, 0xf9b9df6f, 0x8ebeeff9, 0x17b7be43, 0x60b08ed5,
        0xd6d6a3e8, 0xa1d1937e, 0x38d8c2c4, 0x4fdff252, 0xd1bb67f1, 0xa6bc5767, 0x3fb506dd, 0x48b2364b,
        0xd80d2bda, 0xaf0a1b4c, 0x36034af6, 0x41047a60, 0xdf60efc3, 0xa867df55, 0x316e8eef, 0x4669be79,
        0xcb61b38c, 0xbc66831a, 0x256fd2a0, 0x5268e236, 0xcc0c7795, 0xbb0b4703, 0x220216b9, 0x5505262f,
        0xc5ba3bbe, 0xb2bd0b28, 0x2bb45a92, 0x5cb36a04, 0xc2d7ffa7, 0xb5d0cf31, 0x2cd99e8b, 0x5bdeae1d,
        0x9b64c2b0, 0xec63f226, 0x756aa39c, 0x026d930a, 0x9c0906a9, 0xeb0e363f, 0x72076785, 0x05005713,
        0x95bf4a82, 0xe2b87a14, 0x7bb12bae, 0x0cb61b38, 0x92d28e9b, 0xe5d5be0d, 0x7cdcefb7, 0x0bdbdf21,
        0x86d3d2d4, 0xf1d4e242, 0x68ddb3f8, 0x1fda836e, 0x81be16cd, 0xf6b9265b, 0x6fb077e1, 0x18b74777,
        0x88085ae6, 0xff0f6a70, 0x66063bca, 0x11010b5c, 0x8f659eff, 0xf862ae69, 0x616bffd3, 0x166ccf45,
        0xa00ae278, 0xd70dd2ee, 0x4e048354, 0x3903b3c2, 0xa7672661, 0xd06016f7, 0x4969474d, 0x3e6e77db,
        0xaed16a4a, 0xd9d65adc, 0x40df0b66, 0x37d83bf0, 0xa9bcae53, 0xdebb9ec5, 0x47b2cf7f, 0x30b5ffe9,
        0xbdbdf21c, 0xcabac28a, 0x53b39330, 0x24b4a3a6, 0xbad03605, 0xcdd70693, 0x54de5729, 0x23d967bf,
        0xb3667a2e, 0xc4614ab8, 0x5d681b02, 0x2a6f2b94, 0xb40bbe37, 0xc30c8ea1, 0x5a05df1b, 0x2d02ef8d,
    ]);
    /**
     * Calculate the CRC32 of an ArrayBufferLike.
     * @param buf The BufferLike to calculate the CRC32 of.
     */
    function getCrc32(buf) {
        const b = new Uint8Array(buf);
        let crc = -1;
        // tslint:disable-next-line:prefer-for-of
        for (let i = 0; i < b.length; i++) {
            const byte = b[i];
            const t = (byte ^ crc) & 0xff;
            crc = lookUpTable[t] ^ (crc >>> 8);
        }
        return (crc ^ -1) >>> 0;
    }

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

    var sha256 = createCommonjsModule(function (module) {
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

    /**
     * Returns the SHA224 hash of the buffer.
     * @param data Arraybuffer to encode
     */
    function sha224(data) {
        const shaObj = sha256.sha224.create();
        shaObj.update(data);
        return new Uint8Array(shaObj.array());
    }

    const SELF_AUTHENTICATING_SUFFIX = 2;
    const ANONYMOUS_SUFFIX = 4;
    const fromHexString = (hexString) => { var _a; return new Uint8Array(((_a = hexString.match(/.{1,2}/g)) !== null && _a !== void 0 ? _a : []).map(byte => parseInt(byte, 16))); };
    const toHexString = (bytes) => bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
    class Principal$1 {
        constructor(_arr) {
            this._arr = _arr;
            this._isPrincipal = true;
        }
        static anonymous() {
            return new this(new Uint8Array([ANONYMOUS_SUFFIX]));
        }
        static selfAuthenticating(publicKey) {
            const sha = sha224(publicKey);
            return new this(new Uint8Array([...sha, SELF_AUTHENTICATING_SUFFIX]));
        }
        static from(other) {
            if (typeof other === 'string') {
                return Principal$1.fromText(other);
            }
            else if (typeof other === 'object' &&
                other !== null &&
                other._isPrincipal === true) {
                return new Principal$1(other._arr);
            }
            throw new Error(`Impossible to convert ${JSON.stringify(other)} to Principal.`);
        }
        static fromHex(hex) {
            return new this(fromHexString(hex));
        }
        static fromText(text) {
            const canisterIdNoDash = text.toLowerCase().replace(/-/g, '');
            let arr = decode$1(canisterIdNoDash);
            arr = arr.slice(4, arr.length);
            const principal = new this(arr);
            if (principal.toText() !== text) {
                throw new Error(`Principal "${principal.toText()}" does not have a valid checksum.`);
            }
            return principal;
        }
        static fromUint8Array(arr) {
            return new this(arr);
        }
        isAnonymous() {
            return this._arr.byteLength === 1 && this._arr[0] === ANONYMOUS_SUFFIX;
        }
        toUint8Array() {
            return this._arr;
        }
        toHex() {
            return toHexString(this._arr).toUpperCase();
        }
        toText() {
            const checksumArrayBuf = new ArrayBuffer(4);
            const view = new DataView(checksumArrayBuf);
            view.setUint32(0, getCrc32(this._arr));
            const checksum = new Uint8Array(checksumArrayBuf);
            const bytes = Uint8Array.from(this._arr);
            const array = new Uint8Array([...checksum, ...bytes]);
            const result = encode(array);
            const matches = result.match(/.{1,5}/g);
            if (!matches) {
                // This should only happen if there's no character, which is unreachable.
                throw new Error();
            }
            return matches.join('-');
        }
        toString() {
            return this.toText();
        }
    }

    /**
     * Concatenate multiple array buffers.
     * @param buffers The buffers to concatenate.
     */
    function concat(...buffers) {
        const result = new Uint8Array(buffers.reduce((acc, curr) => acc + curr.byteLength, 0));
        let index = 0;
        for (const b of buffers) {
            result.set(new Uint8Array(b), index);
            index += b.byteLength;
        }
        return result;
    }
    /**
     * A class that abstracts a pipe-like ArrayBuffer.
     */
    class PipeArrayBuffer {
        /**
         * Creates a new instance of a pipe
         * @param buffer an optional buffer to start with
         * @param length an optional amount of bytes to use for the length.
         */
        constructor(buffer, length = (buffer === null || buffer === void 0 ? void 0 : buffer.byteLength) || 0) {
            this._buffer = buffer || new ArrayBuffer(0);
            this._view = new Uint8Array(this._buffer, 0, length);
        }
        get buffer() {
            // Return a copy of the buffer.
            return this._view.slice();
        }
        get byteLength() {
            return this._view.byteLength;
        }
        /**
         * Read `num` number of bytes from the front of the pipe.
         * @param num The number of bytes to read.
         */
        read(num) {
            const result = this._view.subarray(0, num);
            this._view = this._view.subarray(num);
            return result.slice().buffer;
        }
        readUint8() {
            const result = this._view[0];
            this._view = this._view.subarray(1);
            return result;
        }
        /**
         * Write a buffer to the end of the pipe.
         * @param buf The bytes to write.
         */
        write(buf) {
            const b = new Uint8Array(buf);
            const offset = this._view.byteLength;
            if (this._view.byteOffset + this._view.byteLength + b.byteLength >= this._buffer.byteLength) {
                // Alloc grow the view to include the new bytes.
                this.alloc(b.byteLength);
            }
            else {
                // Update the view to include the new bytes.
                this._view = new Uint8Array(this._buffer, this._view.byteOffset, this._view.byteLength + b.byteLength);
            }
            this._view.set(b, offset);
        }
        /**
         * Whether or not there is more data to read from the buffer
         */
        get end() {
            return this._view.byteLength === 0;
        }
        /**
         * Allocate a fixed amount of memory in the buffer. This does not affect the view.
         * @param amount A number of bytes to add to the buffer.
         */
        alloc(amount) {
            // Add a little bit of exponential growth.
            // tslint:disable-next-line:no-bitwise
            const b = new ArrayBuffer(((this._buffer.byteLength + amount) * 1.2) | 0);
            const v = new Uint8Array(b, 0, this._view.byteLength + amount);
            v.set(this._view);
            this._buffer = b;
            this._view = v;
        }
    }

    /**
     * Hashes a string to a number. Algorithm can be found here:
     * https://caml.inria.fr/pub/papers/garrigue-polymorphic_variants-ml98.pdf
     * @param s
     */
    function idlHash(s) {
        const utf8encoder = new TextEncoder();
        const array = utf8encoder.encode(s);
        let h = 0;
        for (const c of array) {
            h = (h * 223 + c) % 2 ** 32;
        }
        return h;
    }
    /**
     *
     * @param label string
     * @returns number representing hashed label
     */
    function idlLabelToId(label) {
        if (/^_\d+_$/.test(label) || /^_0x[0-9a-fA-F]+_$/.test(label)) {
            const num = +label.slice(1, -1);
            if (Number.isSafeInteger(num) && num >= 0 && num < 2 ** 32) {
                return num;
            }
        }
        return idlHash(label);
    }

    /* eslint-disable no-constant-condition */
    function eob() {
        throw new Error('unexpected end of buffer');
    }
    /**
     *
     * @param pipe Pipe from buffer-pipe
     * @param num number
     * @returns Buffer
     */
    function safeRead(pipe, num) {
        if (pipe.byteLength < num) {
            eob();
        }
        return pipe.read(num);
    }
    /**
     * @param pipe
     */
    function safeReadUint8(pipe) {
        const byte = pipe.readUint8();
        if (byte === undefined) {
            eob();
        }
        return byte;
    }
    /**
     * Encode a positive number (or bigint) into a Buffer. The number will be floored to the
     * nearest integer.
     * @param value The number to encode.
     */
    function lebEncode(value) {
        if (typeof value === 'number') {
            value = BigInt(value);
        }
        if (value < BigInt(0)) {
            throw new Error('Cannot leb encode negative values.');
        }
        const byteLength = (value === BigInt(0) ? 0 : Math.ceil(Math.log2(Number(value)))) + 1;
        const pipe = new PipeArrayBuffer(new ArrayBuffer(byteLength), 0);
        while (true) {
            const i = Number(value & BigInt(0x7f));
            value /= BigInt(0x80);
            if (value === BigInt(0)) {
                pipe.write(new Uint8Array([i]));
                break;
            }
            else {
                pipe.write(new Uint8Array([i | 0x80]));
            }
        }
        return pipe.buffer;
    }
    /**
     * Decode a leb encoded buffer into a bigint. The number will always be positive (does not
     * support signed leb encoding).
     * @param pipe A Buffer containing the leb encoded bits.
     */
    function lebDecode(pipe) {
        let weight = BigInt(1);
        let value = BigInt(0);
        let byte;
        do {
            byte = safeReadUint8(pipe);
            value += BigInt(byte & 0x7f).valueOf() * weight;
            weight *= BigInt(128);
        } while (byte >= 0x80);
        return value;
    }
    /**
     * Encode a number (or bigint) into a Buffer, with support for negative numbers. The number
     * will be floored to the nearest integer.
     * @param value The number to encode.
     */
    function slebEncode(value) {
        if (typeof value === 'number') {
            value = BigInt(value);
        }
        const isNeg = value < BigInt(0);
        if (isNeg) {
            value = -value - BigInt(1);
        }
        const byteLength = (value === BigInt(0) ? 0 : Math.ceil(Math.log2(Number(value)))) + 1;
        const pipe = new PipeArrayBuffer(new ArrayBuffer(byteLength), 0);
        while (true) {
            const i = getLowerBytes(value);
            value /= BigInt(0x80);
            // prettier-ignore
            if ((isNeg && value === BigInt(0) && (i & 0x40) !== 0)
                || (!isNeg && value === BigInt(0) && (i & 0x40) === 0)) {
                pipe.write(new Uint8Array([i]));
                break;
            }
            else {
                pipe.write(new Uint8Array([i | 0x80]));
            }
        }
        function getLowerBytes(num) {
            const bytes = num % BigInt(0x80);
            if (isNeg) {
                // We swap the bits here again, and remove 1 to do two's complement.
                return Number(BigInt(0x80) - bytes - BigInt(1));
            }
            else {
                return Number(bytes);
            }
        }
        return pipe.buffer;
    }
    /**
     * Decode a leb encoded buffer into a bigint. The number is decoded with support for negative
     * signed-leb encoding.
     * @param pipe A Buffer containing the signed leb encoded bits.
     */
    function slebDecode(pipe) {
        // Get the size of the buffer, then cut a buffer of that size.
        const pipeView = new Uint8Array(pipe.buffer);
        let len = 0;
        for (; len < pipeView.byteLength; len++) {
            if (pipeView[len] < 0x80) {
                // If it's a positive number, we reuse lebDecode.
                if ((pipeView[len] & 0x40) === 0) {
                    return lebDecode(pipe);
                }
                break;
            }
        }
        const bytes = new Uint8Array(safeRead(pipe, len + 1));
        let value = BigInt(0);
        for (let i = bytes.byteLength - 1; i >= 0; i--) {
            value = value * BigInt(0x80) + BigInt(0x80 - (bytes[i] & 0x7f) - 1);
        }
        return -value - BigInt(1);
    }
    /**
     *
     * @param value bigint or number
     * @param byteLength number
     * @returns Buffer
     */
    function writeUIntLE(value, byteLength) {
        if (BigInt(value) < BigInt(0)) {
            throw new Error('Cannot write negative values.');
        }
        return writeIntLE(value, byteLength);
    }
    /**
     *
     * @param value
     * @param byteLength
     */
    function writeIntLE(value, byteLength) {
        value = BigInt(value);
        const pipe = new PipeArrayBuffer(new ArrayBuffer(Math.min(1, byteLength)), 0);
        let i = 0;
        let mul = BigInt(256);
        let sub = BigInt(0);
        let byte = Number(value % mul);
        pipe.write(new Uint8Array([byte]));
        while (++i < byteLength) {
            if (value < 0 && sub === BigInt(0) && byte !== 0) {
                sub = BigInt(1);
            }
            byte = Number((value / mul - sub) % BigInt(256));
            pipe.write(new Uint8Array([byte]));
            mul *= BigInt(256);
        }
        return pipe.buffer;
    }
    /**
     *
     * @param pipe Pipe from buffer-pipe
     * @param byteLength number
     * @returns bigint
     */
    function readUIntLE(pipe, byteLength) {
        let val = BigInt(safeReadUint8(pipe));
        let mul = BigInt(1);
        let i = 0;
        while (++i < byteLength) {
            mul *= BigInt(256);
            const byte = BigInt(safeReadUint8(pipe));
            val = val + mul * byte;
        }
        return val;
    }
    /**
     *
     * @param pipe Pipe from buffer-pipe
     * @param byteLength number
     * @returns bigint
     */
    function readIntLE(pipe, byteLength) {
        let val = readUIntLE(pipe, byteLength);
        const mul = BigInt(2) ** (BigInt(8) * BigInt(byteLength - 1) + BigInt(7));
        if (val >= mul) {
            val -= mul * BigInt(2);
        }
        return val;
    }

    // tslint:disable:max-classes-per-file
    const magicNumber = 'DIDL';
    function zipWith(xs, ys, f) {
        return xs.map((x, i) => f(x, ys[i]));
    }
    /**
     * Represents an IDL type.
     */
    class Type {
        /* Display type name */
        display() {
            return this.name;
        }
        valueToString(x) {
            return toReadableString(x);
        }
        /* Implement `T` in the IDL spec, only needed for non-primitive types */
        buildTypeTable(typeTable) {
            if (!typeTable.has(this)) {
                this._buildTypeTableImpl(typeTable);
            }
        }
    }
    class PrimitiveType extends Type {
        checkType(t) {
            if (this.name !== t.name) {
                throw new Error(`type mismatch: type on the wire ${t.name}, expect type ${this.name}`);
            }
            return t;
        }
        _buildTypeTableImpl(typeTable) {
            // No type table encoding for Primitive types.
            return;
        }
    }
    class ConstructType extends Type {
        checkType(t) {
            if (t instanceof RecClass) {
                const ty = t.getType();
                if (typeof ty === 'undefined') {
                    throw new Error('type mismatch with uninitialized type');
                }
                return ty;
            }
            throw new Error(`type mismatch: type on the wire ${t.name}, expect type ${this.name}`);
        }
        encodeType(typeTable) {
            return typeTable.indexOf(this.name);
        }
    }
    /**
     * Represents an IDL Empty, a type which has no inhabitants.
     * Since no values exist for this type, it cannot be serialised or deserialised.
     * Result types like `Result<Text, Empty>` should always succeed.
     */
    class EmptyClass extends PrimitiveType {
        accept(v, d) {
            return v.visitEmpty(this, d);
        }
        covariant(x) {
            return false;
        }
        encodeValue() {
            throw new Error('Empty cannot appear as a function argument');
        }
        valueToString() {
            throw new Error('Empty cannot appear as a value');
        }
        encodeType() {
            return slebEncode(-17 /* Empty */);
        }
        decodeValue() {
            throw new Error('Empty cannot appear as an output');
        }
        get name() {
            return 'empty';
        }
    }
    /**
     * Represents an IDL Bool
     */
    class BoolClass extends PrimitiveType {
        accept(v, d) {
            return v.visitBool(this, d);
        }
        covariant(x) {
            return typeof x === 'boolean';
        }
        encodeValue(x) {
            return new Uint8Array([x ? 1 : 0]);
        }
        encodeType() {
            return slebEncode(-2 /* Bool */);
        }
        decodeValue(b, t) {
            this.checkType(t);
            switch (safeReadUint8(b)) {
                case 0:
                    return false;
                case 1:
                    return true;
                default:
                    throw new Error('Boolean value out of range');
            }
        }
        get name() {
            return 'bool';
        }
    }
    /**
     * Represents an IDL Null
     */
    class NullClass extends PrimitiveType {
        accept(v, d) {
            return v.visitNull(this, d);
        }
        covariant(x) {
            return x === null;
        }
        encodeValue() {
            return new ArrayBuffer(0);
        }
        encodeType() {
            return slebEncode(-1 /* Null */);
        }
        decodeValue(b, t) {
            this.checkType(t);
            return null;
        }
        get name() {
            return 'null';
        }
    }
    /**
     * Represents an IDL Reserved
     */
    class ReservedClass extends PrimitiveType {
        accept(v, d) {
            return v.visitReserved(this, d);
        }
        covariant(x) {
            return true;
        }
        encodeValue() {
            return new ArrayBuffer(0);
        }
        encodeType() {
            return slebEncode(-16 /* Reserved */);
        }
        decodeValue(b, t) {
            if (t.name !== this.name) {
                t.decodeValue(b, t);
            }
            return null;
        }
        get name() {
            return 'reserved';
        }
    }
    /**
     * Represents an IDL Text
     */
    class TextClass extends PrimitiveType {
        accept(v, d) {
            return v.visitText(this, d);
        }
        covariant(x) {
            return typeof x === 'string';
        }
        encodeValue(x) {
            const buf = new TextEncoder().encode(x);
            const len = lebEncode(buf.byteLength);
            return concat(len, buf);
        }
        encodeType() {
            return slebEncode(-15 /* Text */);
        }
        decodeValue(b, t) {
            this.checkType(t);
            const len = lebDecode(b);
            const buf = safeRead(b, Number(len));
            const decoder = new TextDecoder('utf8', { fatal: true });
            return decoder.decode(buf);
        }
        get name() {
            return 'text';
        }
        valueToString(x) {
            return '"' + x + '"';
        }
    }
    /**
     * Represents an IDL Int
     */
    class IntClass extends PrimitiveType {
        accept(v, d) {
            return v.visitInt(this, d);
        }
        covariant(x) {
            // We allow encoding of JavaScript plain numbers.
            // But we will always decode to bigint.
            return typeof x === 'bigint' || Number.isInteger(x);
        }
        encodeValue(x) {
            return slebEncode(x);
        }
        encodeType() {
            return slebEncode(-4 /* Int */);
        }
        decodeValue(b, t) {
            this.checkType(t);
            return slebDecode(b);
        }
        get name() {
            return 'int';
        }
        valueToString(x) {
            return x.toString();
        }
    }
    /**
     * Represents an IDL Nat
     */
    class NatClass extends PrimitiveType {
        accept(v, d) {
            return v.visitNat(this, d);
        }
        covariant(x) {
            // We allow encoding of JavaScript plain numbers.
            // But we will always decode to bigint.
            return (typeof x === 'bigint' && x >= BigInt(0)) || (Number.isInteger(x) && x >= 0);
        }
        encodeValue(x) {
            return lebEncode(x);
        }
        encodeType() {
            return slebEncode(-3 /* Nat */);
        }
        decodeValue(b, t) {
            this.checkType(t);
            return lebDecode(b);
        }
        get name() {
            return 'nat';
        }
        valueToString(x) {
            return x.toString();
        }
    }
    /**
     * Represents an IDL Float
     */
    class FloatClass extends PrimitiveType {
        constructor(_bits) {
            super();
            this._bits = _bits;
            if (_bits !== 32 && _bits !== 64) {
                throw new Error('not a valid float type');
            }
        }
        accept(v, d) {
            return v.visitFloat(this, d);
        }
        covariant(x) {
            return typeof x === 'number' || x instanceof Number;
        }
        encodeValue(x) {
            const buf = new ArrayBuffer(this._bits / 8);
            const view = new DataView(buf);
            if (this._bits === 32) {
                view.setFloat32(0, x, true);
            }
            else {
                view.setFloat64(0, x, true);
            }
            return buf;
        }
        encodeType() {
            const opcode = this._bits === 32 ? -13 /* Float32 */ : -14 /* Float64 */;
            return slebEncode(opcode);
        }
        decodeValue(b, t) {
            this.checkType(t);
            const bytes = safeRead(b, this._bits / 8);
            const view = new DataView(bytes);
            if (this._bits === 32) {
                return view.getFloat32(0, true);
            }
            else {
                return view.getFloat64(0, true);
            }
        }
        get name() {
            return 'float' + this._bits;
        }
        valueToString(x) {
            return x.toString();
        }
    }
    /**
     * Represents an IDL fixed-width Int(n)
     */
    class FixedIntClass extends PrimitiveType {
        constructor(_bits) {
            super();
            this._bits = _bits;
        }
        accept(v, d) {
            return v.visitFixedInt(this, d);
        }
        covariant(x) {
            const min = BigInt(2) ** BigInt(this._bits - 1) * BigInt(-1);
            const max = BigInt(2) ** BigInt(this._bits - 1) - BigInt(1);
            if (typeof x === 'bigint') {
                return x >= min && x <= max;
            }
            else if (Number.isInteger(x)) {
                const v = BigInt(x);
                return v >= min && v <= max;
            }
            else {
                return false;
            }
        }
        encodeValue(x) {
            return writeIntLE(x, this._bits / 8);
        }
        encodeType() {
            const offset = Math.log2(this._bits) - 3;
            return slebEncode(-9 - offset);
        }
        decodeValue(b, t) {
            this.checkType(t);
            const num = readIntLE(b, this._bits / 8);
            if (this._bits <= 32) {
                return Number(num);
            }
            else {
                return num;
            }
        }
        get name() {
            return `int${this._bits}`;
        }
        valueToString(x) {
            return x.toString();
        }
    }
    /**
     * Represents an IDL fixed-width Nat(n)
     */
    class FixedNatClass extends PrimitiveType {
        constructor(bits) {
            super();
            this.bits = bits;
        }
        accept(v, d) {
            return v.visitFixedNat(this, d);
        }
        covariant(x) {
            const max = BigInt(2) ** BigInt(this.bits);
            if (typeof x === 'bigint' && x >= BigInt(0)) {
                return x < max;
            }
            else if (Number.isInteger(x) && x >= 0) {
                const v = BigInt(x);
                return v < max;
            }
            else {
                return false;
            }
        }
        encodeValue(x) {
            return writeUIntLE(x, this.bits / 8);
        }
        encodeType() {
            const offset = Math.log2(this.bits) - 3;
            return slebEncode(-5 - offset);
        }
        decodeValue(b, t) {
            this.checkType(t);
            const num = readUIntLE(b, this.bits / 8);
            if (this.bits <= 32) {
                return Number(num);
            }
            else {
                return num;
            }
        }
        get name() {
            return `nat${this.bits}`;
        }
        valueToString(x) {
            return x.toString();
        }
    }
    /**
     * Represents an IDL Array
     * @param {Type} t
     */
    class VecClass extends ConstructType {
        constructor(_type) {
            super();
            this._type = _type;
            // If true, this vector is really a blob and we can just use memcpy.
            this._blobOptimization = false;
            if (_type instanceof FixedNatClass && _type.bits === 8) {
                this._blobOptimization = true;
            }
        }
        accept(v, d) {
            return v.visitVec(this, this._type, d);
        }
        covariant(x) {
            return Array.isArray(x) && x.every(v => this._type.covariant(v));
        }
        encodeValue(x) {
            const len = lebEncode(x.length);
            if (this._blobOptimization) {
                return concat(len, new Uint8Array(x));
            }
            return concat(len, ...x.map(d => this._type.encodeValue(d)));
        }
        _buildTypeTableImpl(typeTable) {
            this._type.buildTypeTable(typeTable);
            const opCode = slebEncode(-19 /* Vector */);
            const buffer = this._type.encodeType(typeTable);
            typeTable.add(this, concat(opCode, buffer));
        }
        decodeValue(b, t) {
            const vec = this.checkType(t);
            if (!(vec instanceof VecClass)) {
                throw new Error('Not a vector type');
            }
            const len = Number(lebDecode(b));
            if (this._blobOptimization) {
                return [...new Uint8Array(b.read(len))];
            }
            const rets = [];
            for (let i = 0; i < len; i++) {
                rets.push(this._type.decodeValue(b, vec._type));
            }
            return rets;
        }
        get name() {
            return `vec ${this._type.name}`;
        }
        display() {
            return `vec ${this._type.display()}`;
        }
        valueToString(x) {
            const elements = x.map(e => this._type.valueToString(e));
            return 'vec {' + elements.join('; ') + '}';
        }
    }
    /**
     * Represents an IDL Option
     * @param {Type} t
     */
    class OptClass extends ConstructType {
        constructor(_type) {
            super();
            this._type = _type;
        }
        accept(v, d) {
            return v.visitOpt(this, this._type, d);
        }
        covariant(x) {
            return Array.isArray(x) && (x.length === 0 || (x.length === 1 && this._type.covariant(x[0])));
        }
        encodeValue(x) {
            if (x.length === 0) {
                return new Uint8Array([0]);
            }
            else {
                return concat(new Uint8Array([1]), this._type.encodeValue(x[0]));
            }
        }
        _buildTypeTableImpl(typeTable) {
            this._type.buildTypeTable(typeTable);
            const opCode = slebEncode(-18 /* Opt */);
            const buffer = this._type.encodeType(typeTable);
            typeTable.add(this, concat(opCode, buffer));
        }
        decodeValue(b, t) {
            const opt = this.checkType(t);
            if (!(opt instanceof OptClass)) {
                throw new Error('Not an option type');
            }
            switch (safeReadUint8(b)) {
                case 0:
                    return [];
                case 1:
                    return [this._type.decodeValue(b, opt._type)];
                default:
                    throw new Error('Not an option value');
            }
        }
        get name() {
            return `opt ${this._type.name}`;
        }
        display() {
            return `opt ${this._type.display()}`;
        }
        valueToString(x) {
            if (x.length === 0) {
                return 'null';
            }
            else {
                return `opt ${this._type.valueToString(x[0])}`;
            }
        }
    }
    /**
     * Represents an IDL Record
     * @param {Object} [fields] - mapping of function name to Type
     */
    class RecordClass extends ConstructType {
        constructor(fields = {}) {
            super();
            this._fields = Object.entries(fields).sort((a, b) => idlLabelToId(a[0]) - idlLabelToId(b[0]));
        }
        accept(v, d) {
            return v.visitRecord(this, this._fields, d);
        }
        tryAsTuple() {
            const res = [];
            for (let i = 0; i < this._fields.length; i++) {
                const [key, type] = this._fields[i];
                if (key !== `_${i}_`) {
                    return null;
                }
                res.push(type);
            }
            return res;
        }
        covariant(x) {
            return (typeof x === 'object' &&
                this._fields.every(([k, t]) => {
                    // eslint-disable-next-line
                    if (!x.hasOwnProperty(k)) {
                        throw new Error(`Record is missing key "${k}".`);
                    }
                    return t.covariant(x[k]);
                }));
        }
        encodeValue(x) {
            const values = this._fields.map(([key]) => x[key]);
            const bufs = zipWith(this._fields, values, ([, c], d) => c.encodeValue(d));
            return concat(...bufs);
        }
        _buildTypeTableImpl(T) {
            this._fields.forEach(([_, value]) => value.buildTypeTable(T));
            const opCode = slebEncode(-20 /* Record */);
            const len = lebEncode(this._fields.length);
            const fields = this._fields.map(([key, value]) => concat(lebEncode(idlLabelToId(key)), value.encodeType(T)));
            T.add(this, concat(opCode, len, concat(...fields)));
        }
        decodeValue(b, t) {
            const record = this.checkType(t);
            if (!(record instanceof RecordClass)) {
                throw new Error('Not a record type');
            }
            const x = {};
            let idx = 0;
            for (const [hash, type] of record._fields) {
                if (idx >= this._fields.length || idlLabelToId(this._fields[idx][0]) !== idlLabelToId(hash)) {
                    // skip field
                    type.decodeValue(b, type);
                    continue;
                }
                const [expectKey, expectType] = this._fields[idx];
                x[expectKey] = expectType.decodeValue(b, type);
                idx++;
            }
            if (idx < this._fields.length) {
                throw new Error('Cannot find field ' + this._fields[idx][0]);
            }
            return x;
        }
        get name() {
            const fields = this._fields.map(([key, value]) => key + ':' + value.name);
            return `record {${fields.join('; ')}}`;
        }
        display() {
            const fields = this._fields.map(([key, value]) => key + ':' + value.display());
            return `record {${fields.join('; ')}}`;
        }
        valueToString(x) {
            const values = this._fields.map(([key]) => x[key]);
            const fields = zipWith(this._fields, values, ([k, c], d) => k + '=' + c.valueToString(d));
            return `record {${fields.join('; ')}}`;
        }
    }
    /**
     * Represents Tuple, a syntactic sugar for Record.
     * @param {Type} components
     */
    class TupleClass extends RecordClass {
        constructor(_components) {
            const x = {};
            _components.forEach((e, i) => (x['_' + i + '_'] = e));
            super(x);
            this._components = _components;
        }
        accept(v, d) {
            return v.visitTuple(this, this._components, d);
        }
        covariant(x) {
            // `>=` because tuples can be covariant when encoded.
            return (Array.isArray(x) &&
                x.length >= this._fields.length &&
                this._components.every((t, i) => t.covariant(x[i])));
        }
        encodeValue(x) {
            const bufs = zipWith(this._components, x, (c, d) => c.encodeValue(d));
            return concat(...bufs);
        }
        decodeValue(b, t) {
            const tuple = this.checkType(t);
            if (!(tuple instanceof TupleClass)) {
                throw new Error('not a tuple type');
            }
            if (tuple._components.length < this._components.length) {
                throw new Error('tuple mismatch');
            }
            const res = [];
            for (const [i, wireType] of tuple._components.entries()) {
                if (i >= this._components.length) {
                    // skip value
                    wireType.decodeValue(b, wireType);
                }
                else {
                    res.push(this._components[i].decodeValue(b, wireType));
                }
            }
            return res;
        }
        display() {
            const fields = this._components.map(value => value.display());
            return `record {${fields.join('; ')}}`;
        }
        valueToString(values) {
            const fields = zipWith(this._components, values, (c, d) => c.valueToString(d));
            return `record {${fields.join('; ')}}`;
        }
    }
    /**
     * Represents an IDL Variant
     * @param {Object} [fields] - mapping of function name to Type
     */
    class VariantClass extends ConstructType {
        constructor(fields = {}) {
            super();
            this._fields = Object.entries(fields).sort((a, b) => idlLabelToId(a[0]) - idlLabelToId(b[0]));
        }
        accept(v, d) {
            return v.visitVariant(this, this._fields, d);
        }
        covariant(x) {
            return (typeof x === 'object' &&
                Object.entries(x).length === 1 &&
                this._fields.every(([k, v]) => {
                    // eslint-disable-next-line
                    return !x.hasOwnProperty(k) || v.covariant(x[k]);
                }));
        }
        encodeValue(x) {
            for (let i = 0; i < this._fields.length; i++) {
                const [name, type] = this._fields[i];
                // eslint-disable-next-line
                if (x.hasOwnProperty(name)) {
                    const idx = lebEncode(i);
                    const buf = type.encodeValue(x[name]);
                    return concat(idx, buf);
                }
            }
            throw Error('Variant has no data: ' + x);
        }
        _buildTypeTableImpl(typeTable) {
            this._fields.forEach(([, type]) => {
                type.buildTypeTable(typeTable);
            });
            const opCode = slebEncode(-21 /* Variant */);
            const len = lebEncode(this._fields.length);
            const fields = this._fields.map(([key, value]) => concat(lebEncode(idlLabelToId(key)), value.encodeType(typeTable)));
            typeTable.add(this, concat(opCode, len, ...fields));
        }
        decodeValue(b, t) {
            const variant = this.checkType(t);
            if (!(variant instanceof VariantClass)) {
                throw new Error('Not a variant type');
            }
            const idx = Number(lebDecode(b));
            if (idx >= variant._fields.length) {
                throw Error('Invalid variant index: ' + idx);
            }
            const [wireHash, wireType] = variant._fields[idx];
            for (const [key, expectType] of this._fields) {
                if (idlLabelToId(wireHash) === idlLabelToId(key)) {
                    const value = expectType.decodeValue(b, wireType);
                    return { [key]: value };
                }
            }
            throw new Error('Cannot find field hash ' + wireHash);
        }
        get name() {
            const fields = this._fields.map(([key, type]) => key + ':' + type.name);
            return `variant {${fields.join('; ')}}`;
        }
        display() {
            const fields = this._fields.map(([key, type]) => key + (type.name === 'null' ? '' : `:${type.display()}`));
            return `variant {${fields.join('; ')}}`;
        }
        valueToString(x) {
            for (const [name, type] of this._fields) {
                // eslint-disable-next-line
                if (x.hasOwnProperty(name)) {
                    const value = type.valueToString(x[name]);
                    if (value === 'null') {
                        return `variant {${name}}`;
                    }
                    else {
                        return `variant {${name}=${value}}`;
                    }
                }
            }
            throw new Error('Variant has no data: ' + x);
        }
    }
    /**
     * Represents a reference to an IDL type, used for defining recursive data
     * types.
     */
    class RecClass extends ConstructType {
        constructor() {
            super(...arguments);
            this._id = RecClass._counter++;
            this._type = undefined;
        }
        accept(v, d) {
            if (!this._type) {
                throw Error('Recursive type uninitialized.');
            }
            return v.visitRec(this, this._type, d);
        }
        fill(t) {
            this._type = t;
        }
        getType() {
            return this._type;
        }
        covariant(x) {
            return this._type ? this._type.covariant(x) : false;
        }
        encodeValue(x) {
            if (!this._type) {
                throw Error('Recursive type uninitialized.');
            }
            return this._type.encodeValue(x);
        }
        _buildTypeTableImpl(typeTable) {
            if (!this._type) {
                throw Error('Recursive type uninitialized.');
            }
            typeTable.add(this, new Uint8Array([]));
            this._type.buildTypeTable(typeTable);
            typeTable.merge(this, this._type.name);
        }
        decodeValue(b, t) {
            if (!this._type) {
                throw Error('Recursive type uninitialized.');
            }
            return this._type.decodeValue(b, t);
        }
        get name() {
            return `rec_${this._id}`;
        }
        display() {
            if (!this._type) {
                throw Error('Recursive type uninitialized.');
            }
            return `μ${this.name}.${this._type.name}`;
        }
        valueToString(x) {
            if (!this._type) {
                throw Error('Recursive type uninitialized.');
            }
            return this._type.valueToString(x);
        }
    }
    RecClass._counter = 0;
    function decodePrincipalId(b) {
        const x = safeReadUint8(b);
        if (x !== 1) {
            throw new Error('Cannot decode principal');
        }
        const len = Number(lebDecode(b));
        return Principal$1.fromUint8Array(new Uint8Array(safeRead(b, len)));
    }
    /**
     * Represents an IDL principal reference
     */
    class PrincipalClass extends PrimitiveType {
        accept(v, d) {
            return v.visitPrincipal(this, d);
        }
        covariant(x) {
            return x && x._isPrincipal;
        }
        encodeValue(x) {
            const buf = x.toUint8Array();
            const len = lebEncode(buf.byteLength);
            return concat(new Uint8Array([1]), len, buf);
        }
        encodeType() {
            return slebEncode(-24 /* Principal */);
        }
        decodeValue(b, t) {
            this.checkType(t);
            return decodePrincipalId(b);
        }
        get name() {
            return 'principal';
        }
        valueToString(x) {
            return `${this.name} "${x.toText()}"`;
        }
    }
    /**
     * Represents an IDL function reference.
     * @param argTypes Argument types.
     * @param retTypes Return types.
     * @param annotations Function annotations.
     */
    class FuncClass extends ConstructType {
        constructor(argTypes, retTypes, annotations = []) {
            super();
            this.argTypes = argTypes;
            this.retTypes = retTypes;
            this.annotations = annotations;
        }
        static argsToString(types, v) {
            if (types.length !== v.length) {
                throw new Error('arity mismatch');
            }
            return '(' + types.map((t, i) => t.valueToString(v[i])).join(', ') + ')';
        }
        accept(v, d) {
            return v.visitFunc(this, d);
        }
        covariant(x) {
            return (Array.isArray(x) && x.length === 2 && x[0] && x[0]._isPrincipal && typeof x[1] === 'string');
        }
        encodeValue([principal, methodName]) {
            const buf = principal.toUint8Array();
            const len = lebEncode(buf.byteLength);
            const canister = concat(new Uint8Array([1]), len, buf);
            const method = new TextEncoder().encode(methodName);
            const methodLen = lebEncode(method.byteLength);
            return concat(new Uint8Array([1]), canister, methodLen, method);
        }
        _buildTypeTableImpl(T) {
            this.argTypes.forEach(arg => arg.buildTypeTable(T));
            this.retTypes.forEach(arg => arg.buildTypeTable(T));
            const opCode = slebEncode(-22 /* Func */);
            const argLen = lebEncode(this.argTypes.length);
            const args = concat(...this.argTypes.map(arg => arg.encodeType(T)));
            const retLen = lebEncode(this.retTypes.length);
            const rets = concat(...this.retTypes.map(arg => arg.encodeType(T)));
            const annLen = lebEncode(this.annotations.length);
            const anns = concat(...this.annotations.map(a => this.encodeAnnotation(a)));
            T.add(this, concat(opCode, argLen, args, retLen, rets, annLen, anns));
        }
        decodeValue(b) {
            const x = safeReadUint8(b);
            if (x !== 1) {
                throw new Error('Cannot decode function reference');
            }
            const canister = decodePrincipalId(b);
            const mLen = Number(lebDecode(b));
            const buf = safeRead(b, mLen);
            const decoder = new TextDecoder('utf8', { fatal: true });
            const method = decoder.decode(buf);
            return [canister, method];
        }
        get name() {
            const args = this.argTypes.map(arg => arg.name).join(', ');
            const rets = this.retTypes.map(arg => arg.name).join(', ');
            const annon = ' ' + this.annotations.join(' ');
            return `(${args}) -> (${rets})${annon}`;
        }
        valueToString([principal, str]) {
            return `func "${principal.toText()}".${str}`;
        }
        display() {
            const args = this.argTypes.map(arg => arg.display()).join(', ');
            const rets = this.retTypes.map(arg => arg.display()).join(', ');
            const annon = ' ' + this.annotations.join(' ');
            return `(${args}) → (${rets})${annon}`;
        }
        encodeAnnotation(ann) {
            if (ann === 'query') {
                return new Uint8Array([1]);
            }
            else if (ann === 'oneway') {
                return new Uint8Array([2]);
            }
            else {
                throw new Error('Illeagal function annotation');
            }
        }
    }
    class ServiceClass extends ConstructType {
        constructor(fields) {
            super();
            this._fields = Object.entries(fields).sort((a, b) => idlLabelToId(a[0]) - idlLabelToId(b[0]));
        }
        accept(v, d) {
            return v.visitService(this, d);
        }
        covariant(x) {
            return x && x._isPrincipal;
        }
        encodeValue(x) {
            const buf = x.toUint8Array();
            const len = lebEncode(buf.length);
            return concat(new Uint8Array([1]), len, buf);
        }
        _buildTypeTableImpl(T) {
            this._fields.forEach(([_, func]) => func.buildTypeTable(T));
            const opCode = slebEncode(-23 /* Service */);
            const len = lebEncode(this._fields.length);
            const meths = this._fields.map(([label, func]) => {
                const labelBuf = new TextEncoder().encode(label);
                const labelLen = lebEncode(labelBuf.length);
                return concat(labelLen, labelBuf, func.encodeType(T));
            });
            T.add(this, concat(opCode, len, ...meths));
        }
        decodeValue(b) {
            return decodePrincipalId(b);
        }
        get name() {
            const fields = this._fields.map(([key, value]) => key + ':' + value.name);
            return `service {${fields.join('; ')}}`;
        }
        valueToString(x) {
            return `service "${x.toText()}"`;
        }
    }
    /**
     *
     * @param x
     * @returns {string}
     */
    function toReadableString(x) {
        return JSON.stringify(x, (_key, value) => typeof value === 'bigint' ? `BigInt(${value})` : value);
    }
    /**
     * Decode a binary value
     * @param retTypes - Types expected in the buffer.
     * @param bytes - hex-encoded string, or buffer.
     * @returns Value deserialised to JS type
     */
    function decode(retTypes, bytes) {
        const b = new PipeArrayBuffer(bytes);
        if (bytes.byteLength < magicNumber.length) {
            throw new Error('Message length smaller than magic number');
        }
        const magicBuffer = safeRead(b, magicNumber.length);
        const magic = new TextDecoder().decode(magicBuffer);
        if (magic !== magicNumber) {
            throw new Error('Wrong magic number: ' + JSON.stringify(magic));
        }
        function readTypeTable(pipe) {
            const typeTable = [];
            const len = Number(lebDecode(pipe));
            for (let i = 0; i < len; i++) {
                const ty = Number(slebDecode(pipe));
                switch (ty) {
                    case -18 /* Opt */:
                    case -19 /* Vector */: {
                        const t = Number(slebDecode(pipe));
                        typeTable.push([ty, t]);
                        break;
                    }
                    case -20 /* Record */:
                    case -21 /* Variant */: {
                        const fields = [];
                        let objectLength = Number(lebDecode(pipe));
                        let prevHash;
                        while (objectLength--) {
                            const hash = Number(lebDecode(pipe));
                            if (hash >= Math.pow(2, 32)) {
                                throw new Error('field id out of 32-bit range');
                            }
                            if (typeof prevHash === 'number' && prevHash >= hash) {
                                throw new Error('field id collision or not sorted');
                            }
                            prevHash = hash;
                            const t = Number(slebDecode(pipe));
                            fields.push([hash, t]);
                        }
                        typeTable.push([ty, fields]);
                        break;
                    }
                    case -22 /* Func */: {
                        for (let k = 0; k < 2; k++) {
                            let funcLength = Number(lebDecode(pipe));
                            while (funcLength--) {
                                slebDecode(pipe);
                            }
                        }
                        const annLen = Number(lebDecode(pipe));
                        safeRead(pipe, annLen);
                        typeTable.push([ty, undefined]);
                        break;
                    }
                    case -23 /* Service */: {
                        let servLength = Number(lebDecode(pipe));
                        while (servLength--) {
                            const l = Number(lebDecode(pipe));
                            safeRead(pipe, l);
                            slebDecode(pipe);
                        }
                        typeTable.push([ty, undefined]);
                        break;
                    }
                    default:
                        throw new Error('Illegal op_code: ' + ty);
                }
            }
            const rawList = [];
            const length = Number(lebDecode(pipe));
            for (let i = 0; i < length; i++) {
                rawList.push(Number(slebDecode(pipe)));
            }
            return [typeTable, rawList];
        }
        const [rawTable, rawTypes] = readTypeTable(b);
        if (rawTypes.length < retTypes.length) {
            throw new Error('Wrong number of return values');
        }
        const table = rawTable.map(_ => Rec());
        function getType(t) {
            if (t < -24) {
                throw new Error('future value not supported');
            }
            if (t < 0) {
                switch (t) {
                    case -1:
                        return Null;
                    case -2:
                        return Bool;
                    case -3:
                        return Nat;
                    case -4:
                        return Int;
                    case -5:
                        return Nat8;
                    case -6:
                        return Nat16;
                    case -7:
                        return Nat32;
                    case -8:
                        return Nat64;
                    case -9:
                        return Int8;
                    case -10:
                        return Int16;
                    case -11:
                        return Int32;
                    case -12:
                        return Int64;
                    case -13:
                        return Float32;
                    case -14:
                        return Float64;
                    case -15:
                        return Text;
                    case -16:
                        return Reserved;
                    case -17:
                        return Empty;
                    case -24:
                        return Principal;
                    default:
                        throw new Error('Illegal op_code: ' + t);
                }
            }
            if (t >= rawTable.length) {
                throw new Error('type index out of range');
            }
            return table[t];
        }
        function buildType(entry) {
            switch (entry[0]) {
                case -19 /* Vector */: {
                    const ty = getType(entry[1]);
                    return Vec(ty);
                }
                case -18 /* Opt */: {
                    const ty = getType(entry[1]);
                    return Opt(ty);
                }
                case -20 /* Record */: {
                    const fields = {};
                    for (const [hash, ty] of entry[1]) {
                        const name = `_${hash}_`;
                        fields[name] = getType(ty);
                    }
                    const record = Record(fields);
                    const tuple = record.tryAsTuple();
                    if (Array.isArray(tuple)) {
                        return Tuple(...tuple);
                    }
                    else {
                        return record;
                    }
                }
                case -21 /* Variant */: {
                    const fields = {};
                    for (const [hash, ty] of entry[1]) {
                        const name = `_${hash}_`;
                        fields[name] = getType(ty);
                    }
                    return Variant(fields);
                }
                case -22 /* Func */: {
                    return Func([], [], []);
                }
                case -23 /* Service */: {
                    return Service({});
                }
                default:
                    throw new Error('Illegal op_code: ' + entry[0]);
            }
        }
        rawTable.forEach((entry, i) => {
            const t = buildType(entry);
            table[i].fill(t);
        });
        const types = rawTypes.map(t => getType(t));
        const output = retTypes.map((t, i) => {
            return t.decodeValue(b, types[i]);
        });
        // skip unused values
        for (let ind = retTypes.length; ind < types.length; ind++) {
            types[ind].decodeValue(b, types[ind]);
        }
        if (b.byteLength > 0) {
            throw new Error('decode: Left-over bytes');
        }
        return output;
    }
    // Export Types instances.
    const Empty = new EmptyClass();
    const Reserved = new ReservedClass();
    const Bool = new BoolClass();
    const Null = new NullClass();
    const Text = new TextClass();
    const Int = new IntClass();
    const Nat = new NatClass();
    const Float32 = new FloatClass(32);
    const Float64 = new FloatClass(64);
    const Int8 = new FixedIntClass(8);
    const Int16 = new FixedIntClass(16);
    const Int32 = new FixedIntClass(32);
    const Int64 = new FixedIntClass(64);
    const Nat8 = new FixedNatClass(8);
    const Nat16 = new FixedNatClass(16);
    const Nat32 = new FixedNatClass(32);
    const Nat64 = new FixedNatClass(64);
    const Principal = new PrincipalClass();
    /**
     *
     * @param types array of any types
     * @returns TupleClass from those types
     */
    function Tuple(...types) {
        return new TupleClass(types);
    }
    /**
     *
     * @param t IDL Type
     * @returns VecClass from that type
     */
    function Vec(t) {
        return new VecClass(t);
    }
    /**
     *
     * @param t IDL Type
     * @returns OptClass of Type
     */
    function Opt(t) {
        return new OptClass(t);
    }
    /**
     *
     * @param t Record of string and IDL Type
     * @returns RecordClass of string and Type
     */
    function Record(t) {
        return new RecordClass(t);
    }
    /**
     *
     * @param fields Record of string and IDL Type
     * @returns VariantClass
     */
    function Variant(fields) {
        return new VariantClass(fields);
    }
    /**
     *
     * @returns new RecClass
     */
    function Rec() {
        return new RecClass();
    }
    /**
     *
     * @param args array of IDL Types
     * @param ret array of IDL Types
     * @param annotations array of strings, [] by default
     * @returns new FuncClass
     */
    function Func(args, ret, annotations = []) {
        return new FuncClass(args, ret, annotations);
    }
    /**
     *
     * @param t Record of string and FuncClass
     * @returns ServiceClass
     */
    function Service(t) {
        return new ServiceClass(t);
    }

    const Notification = Variant({
      'DirectMessageNotification' : Record({
        'sender' : Principal,
        'message' : Record({
          'event' : Record({
            'forwarded' : Bool,
            'content' : Variant({
              'File' : Record({
                'name' : Text,
                'mime_type' : Text,
                'file_size' : Nat32,
                'blob_reference' : Opt(
                  Record({ 'blob_id' : Nat, 'canister_id' : Principal })
                ),
                'caption' : Opt(Text),
              }),
              'Text' : Record({ 'text' : Text }),
              'Image' : Record({
                'height' : Nat32,
                'mime_type' : Text,
                'blob_reference' : Opt(
                  Record({ 'blob_id' : Nat, 'canister_id' : Principal })
                ),
                'thumbnail_data' : Text,
                'caption' : Opt(Text),
                'width' : Nat32,
              }),
              'Cryptocurrency' : Record({
                'caption' : Opt(Text),
                'transfer' : Variant({
                  'ICP' : Variant({
                    'Failed' : Record({
                      'fee' : Record({ 'e8s' : Nat64 }),
                      'memo' : Nat64,
                      'error_message' : Text,
                      'recipient' : Principal,
                      'amount' : Record({ 'e8s' : Nat64 }),
                    }),
                    'Completed' : Record({
                      'fee' : Record({ 'e8s' : Nat64 }),
                      'block_index' : Nat64,
                      'memo' : Nat64,
                      'recipient' : Principal,
                      'sender' : Principal,
                      'amount' : Record({ 'e8s' : Nat64 }),
                    }),
                    'Pending' : Record({
                      'fee' : Opt(Record({ 'e8s' : Nat64 })),
                      'memo' : Opt(Nat64),
                      'recipient' : Principal,
                      'amount' : Record({ 'e8s' : Nat64 }),
                    }),
                  }),
                  'Cycles' : Variant({
                    'Failed' : Record({
                      'error_message' : Text,
                      'recipient' : Principal,
                      'cycles' : Nat,
                    }),
                    'Completed' : Record({
                      'recipient' : Principal,
                      'sender' : Principal,
                      'cycles' : Nat,
                    }),
                    'Pending' : Record({
                      'recipient' : Principal,
                      'cycles' : Nat,
                    }),
                  }),
                }),
              }),
              'Audio' : Record({
                'mime_type' : Text,
                'blob_reference' : Opt(
                  Record({ 'blob_id' : Nat, 'canister_id' : Principal })
                ),
                'caption' : Opt(Text),
              }),
              'Video' : Record({
                'height' : Nat32,
                'image_blob_reference' : Opt(
                  Record({ 'blob_id' : Nat, 'canister_id' : Principal })
                ),
                'video_blob_reference' : Opt(
                  Record({ 'blob_id' : Nat, 'canister_id' : Principal })
                ),
                'mime_type' : Text,
                'thumbnail_data' : Text,
                'caption' : Opt(Text),
                'width' : Nat32,
              }),
              'Deleted' : Record({
                'timestamp' : Nat64,
                'deleted_by' : Principal,
              }),
            }),
            'edited' : Bool,
            'sender' : Principal,
            'message_id' : Nat,
            'replies_to' : Opt(
              Record({
                'chat_id_if_other' : Opt(Principal),
                'event_index' : Nat32,
              })
            ),
            'reactions' : Vec(Tuple(Text, Vec(Principal))),
            'message_index' : Nat32,
          }),
          'timestamp' : Nat64,
          'index' : Nat32,
        }),
        'sender_name' : Text,
      }),
      'GroupMessageNotification' : Record({
        'hide' : Bool,
        'mentioned' : Vec(
          Record({ 'username' : Text, 'user_id' : Principal })
        ),
        'sender' : Principal,
        'message' : Record({
          'event' : Record({
            'forwarded' : Bool,
            'content' : Variant({
              'File' : Record({
                'name' : Text,
                'mime_type' : Text,
                'file_size' : Nat32,
                'blob_reference' : Opt(
                  Record({ 'blob_id' : Nat, 'canister_id' : Principal })
                ),
                'caption' : Opt(Text),
              }),
              'Text' : Record({ 'text' : Text }),
              'Image' : Record({
                'height' : Nat32,
                'mime_type' : Text,
                'blob_reference' : Opt(
                  Record({ 'blob_id' : Nat, 'canister_id' : Principal })
                ),
                'thumbnail_data' : Text,
                'caption' : Opt(Text),
                'width' : Nat32,
              }),
              'Cryptocurrency' : Record({
                'caption' : Opt(Text),
                'transfer' : Variant({
                  'ICP' : Variant({
                    'Failed' : Record({
                      'fee' : Record({ 'e8s' : Nat64 }),
                      'memo' : Nat64,
                      'error_message' : Text,
                      'recipient' : Principal,
                      'amount' : Record({ 'e8s' : Nat64 }),
                    }),
                    'Completed' : Record({
                      'fee' : Record({ 'e8s' : Nat64 }),
                      'block_index' : Nat64,
                      'memo' : Nat64,
                      'recipient' : Principal,
                      'sender' : Principal,
                      'amount' : Record({ 'e8s' : Nat64 }),
                    }),
                    'Pending' : Record({
                      'fee' : Opt(Record({ 'e8s' : Nat64 })),
                      'memo' : Opt(Nat64),
                      'recipient' : Principal,
                      'amount' : Record({ 'e8s' : Nat64 }),
                    }),
                  }),
                  'Cycles' : Variant({
                    'Failed' : Record({
                      'error_message' : Text,
                      'recipient' : Principal,
                      'cycles' : Nat,
                    }),
                    'Completed' : Record({
                      'recipient' : Principal,
                      'sender' : Principal,
                      'cycles' : Nat,
                    }),
                    'Pending' : Record({
                      'recipient' : Principal,
                      'cycles' : Nat,
                    }),
                  }),
                }),
              }),
              'Audio' : Record({
                'mime_type' : Text,
                'blob_reference' : Opt(
                  Record({ 'blob_id' : Nat, 'canister_id' : Principal })
                ),
                'caption' : Opt(Text),
              }),
              'Video' : Record({
                'height' : Nat32,
                'image_blob_reference' : Opt(
                  Record({ 'blob_id' : Nat, 'canister_id' : Principal })
                ),
                'video_blob_reference' : Opt(
                  Record({ 'blob_id' : Nat, 'canister_id' : Principal })
                ),
                'mime_type' : Text,
                'thumbnail_data' : Text,
                'caption' : Opt(Text),
                'width' : Nat32,
              }),
              'Deleted' : Record({
                'timestamp' : Nat64,
                'deleted_by' : Principal,
              }),
            }),
            'edited' : Bool,
            'sender' : Principal,
            'message_id' : Nat,
            'replies_to' : Opt(
              Record({
                'chat_id_if_other' : Opt(Principal),
                'event_index' : Nat32,
              })
            ),
            'reactions' : Vec(Tuple(Text, Vec(Principal))),
            'message_index' : Nat32,
          }),
          'timestamp' : Nat64,
          'index' : Nat32,
        }),
        'sender_name' : Text,
        'chat_id' : Principal,
        'group_name' : Text,
      }),
      'AddedToGroupNotification' : Record({
        'added_by_name' : Text,
        'added_by' : Principal,
        'chat_id' : Principal,
        'group_name' : Text,
      }),
    });

    class UnsupportedValueError extends Error {
        constructor(msg, value) {
            super(`${msg}: ${value}`);
        }
    }

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
        if ("Cryptocurrency" in candid) {
            return cryptoContent(candid.Cryptocurrency);
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
    function cryptoContent(candid) {
        return {
            kind: "crypto_content",
            caption: optional(candid.caption, identity),
            transfer: cryptoTransfer(candid.transfer),
        };
    }
    function cryptoTransfer(candid) {
        if ("ICP" in candid) {
            return icpTransfer(candid.ICP);
        }
        if ("Cycles" in candid) {
            return cyclesTransfer(candid.Cycles);
        }
        throw new UnsupportedValueError("Unexpected ApiCryptocurrencyTransfer type received", candid);
    }
    function cyclesTransfer(candid) {
        if ("Pending" in candid) {
            return {
                transferKind: "cycles_transfer",
                kind: "pending_cycles_transfer",
                recipient: candid.Pending.recipient.toString(),
                cycles: candid.Pending.cycles,
            };
        }
        if ("Completed" in candid) {
            return {
                transferKind: "cycles_transfer",
                kind: "completed_cycles_transfer",
                recipient: candid.Completed.recipient.toString(),
                sender: candid.Completed.sender.toString(),
                cycles: candid.Completed.cycles,
            };
        }
        if ("Failed" in candid) {
            return {
                transferKind: "cycles_transfer",
                kind: "failed_cycles_transfer",
                recipient: candid.Failed.recipient.toString(),
                cycles: candid.Failed.cycles,
                errorMessage: candid.Failed.error_message,
            };
        }
        throw new UnsupportedValueError("Unexpected ApiCyclesTransfer type received", candid);
    }
    function icpTransfer(candid) {
        if ("Pending" in candid) {
            return {
                transferKind: "icp_transfer",
                kind: "pending_icp_transfer",
                recipient: candid.Pending.recipient.toString(),
                amountE8s: candid.Pending.amount.e8s,
                feeE8s: optional(candid.Pending.fee, (f) => f.e8s),
                memo: optional(candid.Pending.memo, identity),
            };
        }
        if ("Completed" in candid) {
            return {
                transferKind: "icp_transfer",
                kind: "completed_icp_transfer",
                recipient: candid.Completed.recipient.toString(),
                sender: candid.Completed.sender.toString(),
                amountE8s: candid.Completed.amount.e8s,
                feeE8s: candid.Completed.fee.e8s,
                memo: candid.Completed.memo,
                blockIndex: candid.Completed.block_index,
            };
        }
        if ("Failed" in candid) {
            return {
                transferKind: "icp_transfer",
                kind: "failed_icp_transfer",
                recipient: candid.Failed.recipient.toString(),
                amountE8s: candid.Failed.amount.e8s,
                feeE8s: candid.Failed.fee.e8s,
                memo: candid.Failed.memo,
                errorMessage: candid.Failed.error_message,
            };
        }
        throw new UnsupportedValueError("Unexpected ApiICPTransfer type received", candid);
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
        if ("AddedToGroupNotification" in candid) {
            return addedToGroupNotification(candid.AddedToGroupNotification);
        }
        if ("GroupMessageNotification" in candid) {
            return groupNotification(candid.GroupMessageNotification);
        }
        if ("DirectMessageNotification" in candid) {
            return directNotification(candid.DirectMessageNotification);
        }
        throw new Error(`Unexpected ApiNotification type received, ${candid}`);
    }
    function addedToGroupNotification(candid) {
        return {
            kind: "added_to_group_notification",
            chatId: candid.chat_id.toString(),
            groupName: candid.group_name,
            addedBy: candid.added_by.toString(),
            addedByUsername: candid.added_by_name,
        };
    }
    function groupNotification(candid) {
        return {
            kind: "group_notification",
            sender: candid.sender.toString(),
            message: {
                index: candid.message.index,
                timestamp: candid.message.timestamp,
                event: message(candid.message.event),
            },
            senderName: candid.sender_name,
            chatId: candid.chat_id.toString(),
            groupName: candid.group_name,
            mentioned: candid.mentioned.map((m) => ({
                userId: m.user_id.toText(),
                username: m.username,
            })),
        };
    }
    function directNotification(candid) {
        return {
            kind: "direct_notification",
            sender: candid.sender.toString(),
            message: {
                index: candid.message.index,
                timestamp: candid.message.timestamp,
                event: message(candid.message.event),
            },
            senderName: candid.sender_name,
        };
    }

    function noop() { }
    function run(fn) {
        return fn();
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function get_store_value(store) {
        let value;
        subscribe(store, _ => value = _)();
        return value;
    }
    Promise.resolve();

    const subscriber_queue = [];
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier}start start and stop notifications for subscriptions
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe
        };
    }
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }
    function derived(stores, fn, initial_value) {
        const single = !Array.isArray(stores);
        const stores_array = single
            ? [stores]
            : stores;
        const auto = fn.length < 2;
        return readable(initial_value, (set) => {
            let inited = false;
            const values = [];
            let pending = 0;
            let cleanup = noop;
            const sync = () => {
                if (pending) {
                    return;
                }
                cleanup();
                const result = fn(single ? values[0] : values, set);
                if (auto) {
                    set(result);
                }
                else {
                    cleanup = is_function(result) ? result : noop;
                }
            };
            const unsubscribers = stores_array.map((store, i) => subscribe(store, (value) => {
                values[i] = value;
                pending &= ~(1 << i);
                if (inited) {
                    sync();
                }
            }, () => {
                pending |= (1 << i);
            }));
            inited = true;
            sync();
            return function stop() {
                run_all(unsubscribers);
                cleanup();
            };
        });
    }

    var isMergeableObject = function isMergeableObject(value) {
    	return isNonNullObject(value)
    		&& !isSpecial(value)
    };

    function isNonNullObject(value) {
    	return !!value && typeof value === 'object'
    }

    function isSpecial(value) {
    	var stringValue = Object.prototype.toString.call(value);

    	return stringValue === '[object RegExp]'
    		|| stringValue === '[object Date]'
    		|| isReactElement(value)
    }

    // see https://github.com/facebook/react/blob/b5ac963fb791d1298e7f396236383bc955f916c1/src/isomorphic/classic/element/ReactElement.js#L21-L25
    var canUseSymbol = typeof Symbol === 'function' && Symbol.for;
    var REACT_ELEMENT_TYPE = canUseSymbol ? Symbol.for('react.element') : 0xeac7;

    function isReactElement(value) {
    	return value.$$typeof === REACT_ELEMENT_TYPE
    }

    function emptyTarget(val) {
    	return Array.isArray(val) ? [] : {}
    }

    function cloneUnlessOtherwiseSpecified(value, options) {
    	return (options.clone !== false && options.isMergeableObject(value))
    		? deepmerge(emptyTarget(value), value, options)
    		: value
    }

    function defaultArrayMerge(target, source, options) {
    	return target.concat(source).map(function(element) {
    		return cloneUnlessOtherwiseSpecified(element, options)
    	})
    }

    function getMergeFunction(key, options) {
    	if (!options.customMerge) {
    		return deepmerge
    	}
    	var customMerge = options.customMerge(key);
    	return typeof customMerge === 'function' ? customMerge : deepmerge
    }

    function getEnumerableOwnPropertySymbols(target) {
    	return Object.getOwnPropertySymbols
    		? Object.getOwnPropertySymbols(target).filter(function(symbol) {
    			return target.propertyIsEnumerable(symbol)
    		})
    		: []
    }

    function getKeys(target) {
    	return Object.keys(target).concat(getEnumerableOwnPropertySymbols(target))
    }

    function propertyIsOnObject(object, property) {
    	try {
    		return property in object
    	} catch(_) {
    		return false
    	}
    }

    // Protects from prototype poisoning and unexpected merging up the prototype chain.
    function propertyIsUnsafe(target, key) {
    	return propertyIsOnObject(target, key) // Properties are safe to merge if they don't exist in the target yet,
    		&& !(Object.hasOwnProperty.call(target, key) // unsafe if they exist up the prototype chain,
    			&& Object.propertyIsEnumerable.call(target, key)) // and also unsafe if they're nonenumerable.
    }

    function mergeObject(target, source, options) {
    	var destination = {};
    	if (options.isMergeableObject(target)) {
    		getKeys(target).forEach(function(key) {
    			destination[key] = cloneUnlessOtherwiseSpecified(target[key], options);
    		});
    	}
    	getKeys(source).forEach(function(key) {
    		if (propertyIsUnsafe(target, key)) {
    			return
    		}

    		if (propertyIsOnObject(target, key) && options.isMergeableObject(source[key])) {
    			destination[key] = getMergeFunction(key, options)(target[key], source[key], options);
    		} else {
    			destination[key] = cloneUnlessOtherwiseSpecified(source[key], options);
    		}
    	});
    	return destination
    }

    function deepmerge(target, source, options) {
    	options = options || {};
    	options.arrayMerge = options.arrayMerge || defaultArrayMerge;
    	options.isMergeableObject = options.isMergeableObject || isMergeableObject;
    	// cloneUnlessOtherwiseSpecified is added to `options` so that custom arrayMerge()
    	// implementations can use it. The caller may not replace it.
    	options.cloneUnlessOtherwiseSpecified = cloneUnlessOtherwiseSpecified;

    	var sourceIsArray = Array.isArray(source);
    	var targetIsArray = Array.isArray(target);
    	var sourceAndTargetTypesMatch = sourceIsArray === targetIsArray;

    	if (!sourceAndTargetTypesMatch) {
    		return cloneUnlessOtherwiseSpecified(source, options)
    	} else if (sourceIsArray) {
    		return options.arrayMerge(target, source, options)
    	} else {
    		return mergeObject(target, source, options)
    	}
    }

    deepmerge.all = function deepmergeAll(array, options) {
    	if (!Array.isArray(array)) {
    		throw new Error('first argument should be an array')
    	}

    	return array.reduce(function(prev, next) {
    		return deepmerge(prev, next, options)
    	}, {})
    };

    var deepmerge_1 = deepmerge;

    var cjs = deepmerge_1;

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };

    function __extends(d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    var __assign = function() {
        __assign = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
            }
            return t;
        };
        return __assign.apply(this, arguments);
    };

    function __spreadArray(to, from, pack) {
        if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
            if (ar || !(i in from)) {
                if (!ar) ar = Array.prototype.slice.call(from, 0, i);
                ar[i] = from[i];
            }
        }
        return to.concat(ar || from);
    }

    var ErrorKind;
    (function (ErrorKind) {
        /** Argument is unclosed (e.g. `{0`) */
        ErrorKind[ErrorKind["EXPECT_ARGUMENT_CLOSING_BRACE"] = 1] = "EXPECT_ARGUMENT_CLOSING_BRACE";
        /** Argument is empty (e.g. `{}`). */
        ErrorKind[ErrorKind["EMPTY_ARGUMENT"] = 2] = "EMPTY_ARGUMENT";
        /** Argument is malformed (e.g. `{foo!}``) */
        ErrorKind[ErrorKind["MALFORMED_ARGUMENT"] = 3] = "MALFORMED_ARGUMENT";
        /** Expect an argument type (e.g. `{foo,}`) */
        ErrorKind[ErrorKind["EXPECT_ARGUMENT_TYPE"] = 4] = "EXPECT_ARGUMENT_TYPE";
        /** Unsupported argument type (e.g. `{foo,foo}`) */
        ErrorKind[ErrorKind["INVALID_ARGUMENT_TYPE"] = 5] = "INVALID_ARGUMENT_TYPE";
        /** Expect an argument style (e.g. `{foo, number, }`) */
        ErrorKind[ErrorKind["EXPECT_ARGUMENT_STYLE"] = 6] = "EXPECT_ARGUMENT_STYLE";
        /** The number skeleton is invalid. */
        ErrorKind[ErrorKind["INVALID_NUMBER_SKELETON"] = 7] = "INVALID_NUMBER_SKELETON";
        /** The date time skeleton is invalid. */
        ErrorKind[ErrorKind["INVALID_DATE_TIME_SKELETON"] = 8] = "INVALID_DATE_TIME_SKELETON";
        /** Exepct a number skeleton following the `::` (e.g. `{foo, number, ::}`) */
        ErrorKind[ErrorKind["EXPECT_NUMBER_SKELETON"] = 9] = "EXPECT_NUMBER_SKELETON";
        /** Exepct a date time skeleton following the `::` (e.g. `{foo, date, ::}`) */
        ErrorKind[ErrorKind["EXPECT_DATE_TIME_SKELETON"] = 10] = "EXPECT_DATE_TIME_SKELETON";
        /** Unmatched apostrophes in the argument style (e.g. `{foo, number, 'test`) */
        ErrorKind[ErrorKind["UNCLOSED_QUOTE_IN_ARGUMENT_STYLE"] = 11] = "UNCLOSED_QUOTE_IN_ARGUMENT_STYLE";
        /** Missing select argument options (e.g. `{foo, select}`) */
        ErrorKind[ErrorKind["EXPECT_SELECT_ARGUMENT_OPTIONS"] = 12] = "EXPECT_SELECT_ARGUMENT_OPTIONS";
        /** Expecting an offset value in `plural` or `selectordinal` argument (e.g `{foo, plural, offset}`) */
        ErrorKind[ErrorKind["EXPECT_PLURAL_ARGUMENT_OFFSET_VALUE"] = 13] = "EXPECT_PLURAL_ARGUMENT_OFFSET_VALUE";
        /** Offset value in `plural` or `selectordinal` is invalid (e.g. `{foo, plural, offset: x}`) */
        ErrorKind[ErrorKind["INVALID_PLURAL_ARGUMENT_OFFSET_VALUE"] = 14] = "INVALID_PLURAL_ARGUMENT_OFFSET_VALUE";
        /** Expecting a selector in `select` argument (e.g `{foo, select}`) */
        ErrorKind[ErrorKind["EXPECT_SELECT_ARGUMENT_SELECTOR"] = 15] = "EXPECT_SELECT_ARGUMENT_SELECTOR";
        /** Expecting a selector in `plural` or `selectordinal` argument (e.g `{foo, plural}`) */
        ErrorKind[ErrorKind["EXPECT_PLURAL_ARGUMENT_SELECTOR"] = 16] = "EXPECT_PLURAL_ARGUMENT_SELECTOR";
        /** Expecting a message fragment after the `select` selector (e.g. `{foo, select, apple}`) */
        ErrorKind[ErrorKind["EXPECT_SELECT_ARGUMENT_SELECTOR_FRAGMENT"] = 17] = "EXPECT_SELECT_ARGUMENT_SELECTOR_FRAGMENT";
        /**
         * Expecting a message fragment after the `plural` or `selectordinal` selector
         * (e.g. `{foo, plural, one}`)
         */
        ErrorKind[ErrorKind["EXPECT_PLURAL_ARGUMENT_SELECTOR_FRAGMENT"] = 18] = "EXPECT_PLURAL_ARGUMENT_SELECTOR_FRAGMENT";
        /** Selector in `plural` or `selectordinal` is malformed (e.g. `{foo, plural, =x {#}}`) */
        ErrorKind[ErrorKind["INVALID_PLURAL_ARGUMENT_SELECTOR"] = 19] = "INVALID_PLURAL_ARGUMENT_SELECTOR";
        /**
         * Duplicate selectors in `plural` or `selectordinal` argument.
         * (e.g. {foo, plural, one {#} one {#}})
         */
        ErrorKind[ErrorKind["DUPLICATE_PLURAL_ARGUMENT_SELECTOR"] = 20] = "DUPLICATE_PLURAL_ARGUMENT_SELECTOR";
        /** Duplicate selectors in `select` argument.
         * (e.g. {foo, select, apple {apple} apple {apple}})
         */
        ErrorKind[ErrorKind["DUPLICATE_SELECT_ARGUMENT_SELECTOR"] = 21] = "DUPLICATE_SELECT_ARGUMENT_SELECTOR";
        /** Plural or select argument option must have `other` clause. */
        ErrorKind[ErrorKind["MISSING_OTHER_CLAUSE"] = 22] = "MISSING_OTHER_CLAUSE";
        /** The tag is malformed. (e.g. `<bold!>foo</bold!>) */
        ErrorKind[ErrorKind["INVALID_TAG"] = 23] = "INVALID_TAG";
        /** The tag name is invalid. (e.g. `<123>foo</123>`) */
        ErrorKind[ErrorKind["INVALID_TAG_NAME"] = 25] = "INVALID_TAG_NAME";
        /** The closing tag does not match the opening tag. (e.g. `<bold>foo</italic>`) */
        ErrorKind[ErrorKind["UNMATCHED_CLOSING_TAG"] = 26] = "UNMATCHED_CLOSING_TAG";
        /** The opening tag has unmatched closing tag. (e.g. `<bold>foo`) */
        ErrorKind[ErrorKind["UNCLOSED_TAG"] = 27] = "UNCLOSED_TAG";
    })(ErrorKind || (ErrorKind = {}));

    var TYPE;
    (function (TYPE) {
        /**
         * Raw text
         */
        TYPE[TYPE["literal"] = 0] = "literal";
        /**
         * Variable w/o any format, e.g `var` in `this is a {var}`
         */
        TYPE[TYPE["argument"] = 1] = "argument";
        /**
         * Variable w/ number format
         */
        TYPE[TYPE["number"] = 2] = "number";
        /**
         * Variable w/ date format
         */
        TYPE[TYPE["date"] = 3] = "date";
        /**
         * Variable w/ time format
         */
        TYPE[TYPE["time"] = 4] = "time";
        /**
         * Variable w/ select format
         */
        TYPE[TYPE["select"] = 5] = "select";
        /**
         * Variable w/ plural format
         */
        TYPE[TYPE["plural"] = 6] = "plural";
        /**
         * Only possible within plural argument.
         * This is the `#` symbol that will be substituted with the count.
         */
        TYPE[TYPE["pound"] = 7] = "pound";
        /**
         * XML-like tag
         */
        TYPE[TYPE["tag"] = 8] = "tag";
    })(TYPE || (TYPE = {}));
    var SKELETON_TYPE;
    (function (SKELETON_TYPE) {
        SKELETON_TYPE[SKELETON_TYPE["number"] = 0] = "number";
        SKELETON_TYPE[SKELETON_TYPE["dateTime"] = 1] = "dateTime";
    })(SKELETON_TYPE || (SKELETON_TYPE = {}));
    /**
     * Type Guards
     */
    function isLiteralElement(el) {
        return el.type === TYPE.literal;
    }
    function isArgumentElement(el) {
        return el.type === TYPE.argument;
    }
    function isNumberElement(el) {
        return el.type === TYPE.number;
    }
    function isDateElement(el) {
        return el.type === TYPE.date;
    }
    function isTimeElement(el) {
        return el.type === TYPE.time;
    }
    function isSelectElement(el) {
        return el.type === TYPE.select;
    }
    function isPluralElement(el) {
        return el.type === TYPE.plural;
    }
    function isPoundElement(el) {
        return el.type === TYPE.pound;
    }
    function isTagElement(el) {
        return el.type === TYPE.tag;
    }
    function isNumberSkeleton(el) {
        return !!(el && typeof el === 'object' && el.type === SKELETON_TYPE.number);
    }
    function isDateTimeSkeleton(el) {
        return !!(el && typeof el === 'object' && el.type === SKELETON_TYPE.dateTime);
    }

    // @generated from regex-gen.ts
    var SPACE_SEPARATOR_REGEX = /[ \xA0\u1680\u2000-\u200A\u202F\u205F\u3000]/;

    /**
     * https://unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table
     * Credit: https://github.com/caridy/intl-datetimeformat-pattern/blob/master/index.js
     * with some tweaks
     */
    var DATE_TIME_REGEX = /(?:[Eec]{1,6}|G{1,5}|[Qq]{1,5}|(?:[yYur]+|U{1,5})|[ML]{1,5}|d{1,2}|D{1,3}|F{1}|[abB]{1,5}|[hkHK]{1,2}|w{1,2}|W{1}|m{1,2}|s{1,2}|[zZOvVxX]{1,4})(?=([^']*'[^']*')*[^']*$)/g;
    /**
     * Parse Date time skeleton into Intl.DateTimeFormatOptions
     * Ref: https://unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table
     * @public
     * @param skeleton skeleton string
     */
    function parseDateTimeSkeleton(skeleton) {
        var result = {};
        skeleton.replace(DATE_TIME_REGEX, function (match) {
            var len = match.length;
            switch (match[0]) {
                // Era
                case 'G':
                    result.era = len === 4 ? 'long' : len === 5 ? 'narrow' : 'short';
                    break;
                // Year
                case 'y':
                    result.year = len === 2 ? '2-digit' : 'numeric';
                    break;
                case 'Y':
                case 'u':
                case 'U':
                case 'r':
                    throw new RangeError('`Y/u/U/r` (year) patterns are not supported, use `y` instead');
                // Quarter
                case 'q':
                case 'Q':
                    throw new RangeError('`q/Q` (quarter) patterns are not supported');
                // Month
                case 'M':
                case 'L':
                    result.month = ['numeric', '2-digit', 'short', 'long', 'narrow'][len - 1];
                    break;
                // Week
                case 'w':
                case 'W':
                    throw new RangeError('`w/W` (week) patterns are not supported');
                case 'd':
                    result.day = ['numeric', '2-digit'][len - 1];
                    break;
                case 'D':
                case 'F':
                case 'g':
                    throw new RangeError('`D/F/g` (day) patterns are not supported, use `d` instead');
                // Weekday
                case 'E':
                    result.weekday = len === 4 ? 'short' : len === 5 ? 'narrow' : 'short';
                    break;
                case 'e':
                    if (len < 4) {
                        throw new RangeError('`e..eee` (weekday) patterns are not supported');
                    }
                    result.weekday = ['short', 'long', 'narrow', 'short'][len - 4];
                    break;
                case 'c':
                    if (len < 4) {
                        throw new RangeError('`c..ccc` (weekday) patterns are not supported');
                    }
                    result.weekday = ['short', 'long', 'narrow', 'short'][len - 4];
                    break;
                // Period
                case 'a': // AM, PM
                    result.hour12 = true;
                    break;
                case 'b': // am, pm, noon, midnight
                case 'B': // flexible day periods
                    throw new RangeError('`b/B` (period) patterns are not supported, use `a` instead');
                // Hour
                case 'h':
                    result.hourCycle = 'h12';
                    result.hour = ['numeric', '2-digit'][len - 1];
                    break;
                case 'H':
                    result.hourCycle = 'h23';
                    result.hour = ['numeric', '2-digit'][len - 1];
                    break;
                case 'K':
                    result.hourCycle = 'h11';
                    result.hour = ['numeric', '2-digit'][len - 1];
                    break;
                case 'k':
                    result.hourCycle = 'h24';
                    result.hour = ['numeric', '2-digit'][len - 1];
                    break;
                case 'j':
                case 'J':
                case 'C':
                    throw new RangeError('`j/J/C` (hour) patterns are not supported, use `h/H/K/k` instead');
                // Minute
                case 'm':
                    result.minute = ['numeric', '2-digit'][len - 1];
                    break;
                // Second
                case 's':
                    result.second = ['numeric', '2-digit'][len - 1];
                    break;
                case 'S':
                case 'A':
                    throw new RangeError('`S/A` (second) patterns are not supported, use `s` instead');
                // Zone
                case 'z': // 1..3, 4: specific non-location format
                    result.timeZoneName = len < 4 ? 'short' : 'long';
                    break;
                case 'Z': // 1..3, 4, 5: The ISO8601 varios formats
                case 'O': // 1, 4: miliseconds in day short, long
                case 'v': // 1, 4: generic non-location format
                case 'V': // 1, 2, 3, 4: time zone ID or city
                case 'X': // 1, 2, 3, 4: The ISO8601 varios formats
                case 'x': // 1, 2, 3, 4: The ISO8601 varios formats
                    throw new RangeError('`Z/O/v/V/X/x` (timeZone) patterns are not supported, use `z` instead');
            }
            return '';
        });
        return result;
    }

    // @generated from regex-gen.ts
    var WHITE_SPACE_REGEX = /[\t-\r \x85\u200E\u200F\u2028\u2029]/i;

    function parseNumberSkeletonFromString(skeleton) {
        if (skeleton.length === 0) {
            throw new Error('Number skeleton cannot be empty');
        }
        // Parse the skeleton
        var stringTokens = skeleton
            .split(WHITE_SPACE_REGEX)
            .filter(function (x) { return x.length > 0; });
        var tokens = [];
        for (var _i = 0, stringTokens_1 = stringTokens; _i < stringTokens_1.length; _i++) {
            var stringToken = stringTokens_1[_i];
            var stemAndOptions = stringToken.split('/');
            if (stemAndOptions.length === 0) {
                throw new Error('Invalid number skeleton');
            }
            var stem = stemAndOptions[0], options = stemAndOptions.slice(1);
            for (var _a = 0, options_1 = options; _a < options_1.length; _a++) {
                var option = options_1[_a];
                if (option.length === 0) {
                    throw new Error('Invalid number skeleton');
                }
            }
            tokens.push({ stem: stem, options: options });
        }
        return tokens;
    }
    function icuUnitToEcma(unit) {
        return unit.replace(/^(.*?)-/, '');
    }
    var FRACTION_PRECISION_REGEX = /^\.(?:(0+)(\*)?|(#+)|(0+)(#+))$/g;
    var SIGNIFICANT_PRECISION_REGEX = /^(@+)?(\+|#+)?$/g;
    var INTEGER_WIDTH_REGEX = /(\*)(0+)|(#+)(0+)|(0+)/g;
    var CONCISE_INTEGER_WIDTH_REGEX = /^(0+)$/;
    function parseSignificantPrecision(str) {
        var result = {};
        str.replace(SIGNIFICANT_PRECISION_REGEX, function (_, g1, g2) {
            // @@@ case
            if (typeof g2 !== 'string') {
                result.minimumSignificantDigits = g1.length;
                result.maximumSignificantDigits = g1.length;
            }
            // @@@+ case
            else if (g2 === '+') {
                result.minimumSignificantDigits = g1.length;
            }
            // .### case
            else if (g1[0] === '#') {
                result.maximumSignificantDigits = g1.length;
            }
            // .@@## or .@@@ case
            else {
                result.minimumSignificantDigits = g1.length;
                result.maximumSignificantDigits =
                    g1.length + (typeof g2 === 'string' ? g2.length : 0);
            }
            return '';
        });
        return result;
    }
    function parseSign(str) {
        switch (str) {
            case 'sign-auto':
                return {
                    signDisplay: 'auto',
                };
            case 'sign-accounting':
            case '()':
                return {
                    currencySign: 'accounting',
                };
            case 'sign-always':
            case '+!':
                return {
                    signDisplay: 'always',
                };
            case 'sign-accounting-always':
            case '()!':
                return {
                    signDisplay: 'always',
                    currencySign: 'accounting',
                };
            case 'sign-except-zero':
            case '+?':
                return {
                    signDisplay: 'exceptZero',
                };
            case 'sign-accounting-except-zero':
            case '()?':
                return {
                    signDisplay: 'exceptZero',
                    currencySign: 'accounting',
                };
            case 'sign-never':
            case '+_':
                return {
                    signDisplay: 'never',
                };
        }
    }
    function parseConciseScientificAndEngineeringStem(stem) {
        // Engineering
        var result;
        if (stem[0] === 'E' && stem[1] === 'E') {
            result = {
                notation: 'engineering',
            };
            stem = stem.slice(2);
        }
        else if (stem[0] === 'E') {
            result = {
                notation: 'scientific',
            };
            stem = stem.slice(1);
        }
        if (result) {
            var signDisplay = stem.slice(0, 2);
            if (signDisplay === '+!') {
                result.signDisplay = 'always';
                stem = stem.slice(2);
            }
            else if (signDisplay === '+?') {
                result.signDisplay = 'exceptZero';
                stem = stem.slice(2);
            }
            if (!CONCISE_INTEGER_WIDTH_REGEX.test(stem)) {
                throw new Error('Malformed concise eng/scientific notation');
            }
            result.minimumIntegerDigits = stem.length;
        }
        return result;
    }
    function parseNotationOptions(opt) {
        var result = {};
        var signOpts = parseSign(opt);
        if (signOpts) {
            return signOpts;
        }
        return result;
    }
    /**
     * https://github.com/unicode-org/icu/blob/master/docs/userguide/format_parse/numbers/skeletons.md#skeleton-stems-and-options
     */
    function parseNumberSkeleton(tokens) {
        var result = {};
        for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
            var token = tokens_1[_i];
            switch (token.stem) {
                case 'percent':
                case '%':
                    result.style = 'percent';
                    continue;
                case '%x100':
                    result.style = 'percent';
                    result.scale = 100;
                    continue;
                case 'currency':
                    result.style = 'currency';
                    result.currency = token.options[0];
                    continue;
                case 'group-off':
                case ',_':
                    result.useGrouping = false;
                    continue;
                case 'precision-integer':
                case '.':
                    result.maximumFractionDigits = 0;
                    continue;
                case 'measure-unit':
                case 'unit':
                    result.style = 'unit';
                    result.unit = icuUnitToEcma(token.options[0]);
                    continue;
                case 'compact-short':
                case 'K':
                    result.notation = 'compact';
                    result.compactDisplay = 'short';
                    continue;
                case 'compact-long':
                case 'KK':
                    result.notation = 'compact';
                    result.compactDisplay = 'long';
                    continue;
                case 'scientific':
                    result = __assign(__assign(__assign({}, result), { notation: 'scientific' }), token.options.reduce(function (all, opt) { return (__assign(__assign({}, all), parseNotationOptions(opt))); }, {}));
                    continue;
                case 'engineering':
                    result = __assign(__assign(__assign({}, result), { notation: 'engineering' }), token.options.reduce(function (all, opt) { return (__assign(__assign({}, all), parseNotationOptions(opt))); }, {}));
                    continue;
                case 'notation-simple':
                    result.notation = 'standard';
                    continue;
                // https://github.com/unicode-org/icu/blob/master/icu4c/source/i18n/unicode/unumberformatter.h
                case 'unit-width-narrow':
                    result.currencyDisplay = 'narrowSymbol';
                    result.unitDisplay = 'narrow';
                    continue;
                case 'unit-width-short':
                    result.currencyDisplay = 'code';
                    result.unitDisplay = 'short';
                    continue;
                case 'unit-width-full-name':
                    result.currencyDisplay = 'name';
                    result.unitDisplay = 'long';
                    continue;
                case 'unit-width-iso-code':
                    result.currencyDisplay = 'symbol';
                    continue;
                case 'scale':
                    result.scale = parseFloat(token.options[0]);
                    continue;
                // https://unicode-org.github.io/icu/userguide/format_parse/numbers/skeletons.html#integer-width
                case 'integer-width':
                    if (token.options.length > 1) {
                        throw new RangeError('integer-width stems only accept a single optional option');
                    }
                    token.options[0].replace(INTEGER_WIDTH_REGEX, function (_, g1, g2, g3, g4, g5) {
                        if (g1) {
                            result.minimumIntegerDigits = g2.length;
                        }
                        else if (g3 && g4) {
                            throw new Error('We currently do not support maximum integer digits');
                        }
                        else if (g5) {
                            throw new Error('We currently do not support exact integer digits');
                        }
                        return '';
                    });
                    continue;
            }
            // https://unicode-org.github.io/icu/userguide/format_parse/numbers/skeletons.html#integer-width
            if (CONCISE_INTEGER_WIDTH_REGEX.test(token.stem)) {
                result.minimumIntegerDigits = token.stem.length;
                continue;
            }
            if (FRACTION_PRECISION_REGEX.test(token.stem)) {
                // Precision
                // https://unicode-org.github.io/icu/userguide/format_parse/numbers/skeletons.html#fraction-precision
                // precision-integer case
                if (token.options.length > 1) {
                    throw new RangeError('Fraction-precision stems only accept a single optional option');
                }
                token.stem.replace(FRACTION_PRECISION_REGEX, function (_, g1, g2, g3, g4, g5) {
                    // .000* case (before ICU67 it was .000+)
                    if (g2 === '*') {
                        result.minimumFractionDigits = g1.length;
                    }
                    // .### case
                    else if (g3 && g3[0] === '#') {
                        result.maximumFractionDigits = g3.length;
                    }
                    // .00## case
                    else if (g4 && g5) {
                        result.minimumFractionDigits = g4.length;
                        result.maximumFractionDigits = g4.length + g5.length;
                    }
                    else {
                        result.minimumFractionDigits = g1.length;
                        result.maximumFractionDigits = g1.length;
                    }
                    return '';
                });
                if (token.options.length) {
                    result = __assign(__assign({}, result), parseSignificantPrecision(token.options[0]));
                }
                continue;
            }
            // https://unicode-org.github.io/icu/userguide/format_parse/numbers/skeletons.html#significant-digits-precision
            if (SIGNIFICANT_PRECISION_REGEX.test(token.stem)) {
                result = __assign(__assign({}, result), parseSignificantPrecision(token.stem));
                continue;
            }
            var signOpts = parseSign(token.stem);
            if (signOpts) {
                result = __assign(__assign({}, result), signOpts);
            }
            var conciseScientificAndEngineeringOpts = parseConciseScientificAndEngineeringStem(token.stem);
            if (conciseScientificAndEngineeringOpts) {
                result = __assign(__assign({}, result), conciseScientificAndEngineeringOpts);
            }
        }
        return result;
    }

    var _a;
    var SPACE_SEPARATOR_START_REGEX = new RegExp("^" + SPACE_SEPARATOR_REGEX.source + "*");
    var SPACE_SEPARATOR_END_REGEX = new RegExp(SPACE_SEPARATOR_REGEX.source + "*$");
    function createLocation(start, end) {
        return { start: start, end: end };
    }
    // #region Ponyfills
    // Consolidate these variables up top for easier toggling during debugging
    var hasNativeStartsWith = !!String.prototype.startsWith;
    var hasNativeFromCodePoint = !!String.fromCodePoint;
    var hasNativeFromEntries = !!Object.fromEntries;
    var hasNativeCodePointAt = !!String.prototype.codePointAt;
    var hasTrimStart = !!String.prototype.trimStart;
    var hasTrimEnd = !!String.prototype.trimEnd;
    var hasNativeIsSafeInteger = !!Number.isSafeInteger;
    var isSafeInteger = hasNativeIsSafeInteger
        ? Number.isSafeInteger
        : function (n) {
            return (typeof n === 'number' &&
                isFinite(n) &&
                Math.floor(n) === n &&
                Math.abs(n) <= 0x1fffffffffffff);
        };
    // IE11 does not support y and u.
    var REGEX_SUPPORTS_U_AND_Y = true;
    try {
        var re = RE('([^\\p{White_Space}\\p{Pattern_Syntax}]*)', 'yu');
        /**
         * legacy Edge or Xbox One browser
         * Unicode flag support: supported
         * Pattern_Syntax support: not supported
         * See https://github.com/formatjs/formatjs/issues/2822
         */
        REGEX_SUPPORTS_U_AND_Y = ((_a = re.exec('a')) === null || _a === void 0 ? void 0 : _a[0]) === 'a';
    }
    catch (_) {
        REGEX_SUPPORTS_U_AND_Y = false;
    }
    var startsWith = hasNativeStartsWith
        ? // Native
            function startsWith(s, search, position) {
                return s.startsWith(search, position);
            }
        : // For IE11
            function startsWith(s, search, position) {
                return s.slice(position, position + search.length) === search;
            };
    var fromCodePoint = hasNativeFromCodePoint
        ? String.fromCodePoint
        : // IE11
            function fromCodePoint() {
                var codePoints = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    codePoints[_i] = arguments[_i];
                }
                var elements = '';
                var length = codePoints.length;
                var i = 0;
                var code;
                while (length > i) {
                    code = codePoints[i++];
                    if (code > 0x10ffff)
                        throw RangeError(code + ' is not a valid code point');
                    elements +=
                        code < 0x10000
                            ? String.fromCharCode(code)
                            : String.fromCharCode(((code -= 0x10000) >> 10) + 0xd800, (code % 0x400) + 0xdc00);
                }
                return elements;
            };
    var fromEntries = 
    // native
    hasNativeFromEntries
        ? Object.fromEntries
        : // Ponyfill
            function fromEntries(entries) {
                var obj = {};
                for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
                    var _a = entries_1[_i], k = _a[0], v = _a[1];
                    obj[k] = v;
                }
                return obj;
            };
    var codePointAt = hasNativeCodePointAt
        ? // Native
            function codePointAt(s, index) {
                return s.codePointAt(index);
            }
        : // IE 11
            function codePointAt(s, index) {
                var size = s.length;
                if (index < 0 || index >= size) {
                    return undefined;
                }
                var first = s.charCodeAt(index);
                var second;
                return first < 0xd800 ||
                    first > 0xdbff ||
                    index + 1 === size ||
                    (second = s.charCodeAt(index + 1)) < 0xdc00 ||
                    second > 0xdfff
                    ? first
                    : ((first - 0xd800) << 10) + (second - 0xdc00) + 0x10000;
            };
    var trimStart = hasTrimStart
        ? // Native
            function trimStart(s) {
                return s.trimStart();
            }
        : // Ponyfill
            function trimStart(s) {
                return s.replace(SPACE_SEPARATOR_START_REGEX, '');
            };
    var trimEnd = hasTrimEnd
        ? // Native
            function trimEnd(s) {
                return s.trimEnd();
            }
        : // Ponyfill
            function trimEnd(s) {
                return s.replace(SPACE_SEPARATOR_END_REGEX, '');
            };
    // Prevent minifier to translate new RegExp to literal form that might cause syntax error on IE11.
    function RE(s, flag) {
        return new RegExp(s, flag);
    }
    // #endregion
    var matchIdentifierAtIndex;
    if (REGEX_SUPPORTS_U_AND_Y) {
        // Native
        var IDENTIFIER_PREFIX_RE_1 = RE('([^\\p{White_Space}\\p{Pattern_Syntax}]*)', 'yu');
        matchIdentifierAtIndex = function matchIdentifierAtIndex(s, index) {
            var _a;
            IDENTIFIER_PREFIX_RE_1.lastIndex = index;
            var match = IDENTIFIER_PREFIX_RE_1.exec(s);
            return (_a = match[1]) !== null && _a !== void 0 ? _a : '';
        };
    }
    else {
        // IE11
        matchIdentifierAtIndex = function matchIdentifierAtIndex(s, index) {
            var match = [];
            while (true) {
                var c = codePointAt(s, index);
                if (c === undefined || _isWhiteSpace(c) || _isPatternSyntax(c)) {
                    break;
                }
                match.push(c);
                index += c >= 0x10000 ? 2 : 1;
            }
            return fromCodePoint.apply(void 0, match);
        };
    }
    var Parser = /** @class */ (function () {
        function Parser(message, options) {
            if (options === void 0) { options = {}; }
            this.message = message;
            this.position = { offset: 0, line: 1, column: 1 };
            this.ignoreTag = !!options.ignoreTag;
            this.requiresOtherClause = !!options.requiresOtherClause;
            this.shouldParseSkeletons = !!options.shouldParseSkeletons;
        }
        Parser.prototype.parse = function () {
            if (this.offset() !== 0) {
                throw Error('parser can only be used once');
            }
            return this.parseMessage(0, '', false);
        };
        Parser.prototype.parseMessage = function (nestingLevel, parentArgType, expectingCloseTag) {
            var elements = [];
            while (!this.isEOF()) {
                var char = this.char();
                if (char === 123 /* `{` */) {
                    var result = this.parseArgument(nestingLevel, expectingCloseTag);
                    if (result.err) {
                        return result;
                    }
                    elements.push(result.val);
                }
                else if (char === 125 /* `}` */ && nestingLevel > 0) {
                    break;
                }
                else if (char === 35 /* `#` */ &&
                    (parentArgType === 'plural' || parentArgType === 'selectordinal')) {
                    var position = this.clonePosition();
                    this.bump();
                    elements.push({
                        type: TYPE.pound,
                        location: createLocation(position, this.clonePosition()),
                    });
                }
                else if (char === 60 /* `<` */ &&
                    !this.ignoreTag &&
                    this.peek() === 47 // char code for '/'
                ) {
                    if (expectingCloseTag) {
                        break;
                    }
                    else {
                        return this.error(ErrorKind.UNMATCHED_CLOSING_TAG, createLocation(this.clonePosition(), this.clonePosition()));
                    }
                }
                else if (char === 60 /* `<` */ &&
                    !this.ignoreTag &&
                    _isAlpha(this.peek() || 0)) {
                    var result = this.parseTag(nestingLevel, parentArgType);
                    if (result.err) {
                        return result;
                    }
                    elements.push(result.val);
                }
                else {
                    var result = this.parseLiteral(nestingLevel, parentArgType);
                    if (result.err) {
                        return result;
                    }
                    elements.push(result.val);
                }
            }
            return { val: elements, err: null };
        };
        /**
         * A tag name must start with an ASCII lower/upper case letter. The grammar is based on the
         * [custom element name][] except that a dash is NOT always mandatory and uppercase letters
         * are accepted:
         *
         * ```
         * tag ::= "<" tagName (whitespace)* "/>" | "<" tagName (whitespace)* ">" message "</" tagName (whitespace)* ">"
         * tagName ::= [a-z] (PENChar)*
         * PENChar ::=
         *     "-" | "." | [0-9] | "_" | [a-z] | [A-Z] | #xB7 | [#xC0-#xD6] | [#xD8-#xF6] | [#xF8-#x37D] |
         *     [#x37F-#x1FFF] | [#x200C-#x200D] | [#x203F-#x2040] | [#x2070-#x218F] | [#x2C00-#x2FEF] |
         *     [#x3001-#xD7FF] | [#xF900-#xFDCF] | [#xFDF0-#xFFFD] | [#x10000-#xEFFFF]
         * ```
         *
         * [custom element name]: https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name
         * NOTE: We're a bit more lax here since HTML technically does not allow uppercase HTML element but we do
         * since other tag-based engines like React allow it
         */
        Parser.prototype.parseTag = function (nestingLevel, parentArgType) {
            var startPosition = this.clonePosition();
            this.bump(); // `<`
            var tagName = this.parseTagName();
            this.bumpSpace();
            if (this.bumpIf('/>')) {
                // Self closing tag
                return {
                    val: {
                        type: TYPE.literal,
                        value: "<" + tagName + "/>",
                        location: createLocation(startPosition, this.clonePosition()),
                    },
                    err: null,
                };
            }
            else if (this.bumpIf('>')) {
                var childrenResult = this.parseMessage(nestingLevel + 1, parentArgType, true);
                if (childrenResult.err) {
                    return childrenResult;
                }
                var children = childrenResult.val;
                // Expecting a close tag
                var endTagStartPosition = this.clonePosition();
                if (this.bumpIf('</')) {
                    if (this.isEOF() || !_isAlpha(this.char())) {
                        return this.error(ErrorKind.INVALID_TAG, createLocation(endTagStartPosition, this.clonePosition()));
                    }
                    var closingTagNameStartPosition = this.clonePosition();
                    var closingTagName = this.parseTagName();
                    if (tagName !== closingTagName) {
                        return this.error(ErrorKind.UNMATCHED_CLOSING_TAG, createLocation(closingTagNameStartPosition, this.clonePosition()));
                    }
                    this.bumpSpace();
                    if (!this.bumpIf('>')) {
                        return this.error(ErrorKind.INVALID_TAG, createLocation(endTagStartPosition, this.clonePosition()));
                    }
                    return {
                        val: {
                            type: TYPE.tag,
                            value: tagName,
                            children: children,
                            location: createLocation(startPosition, this.clonePosition()),
                        },
                        err: null,
                    };
                }
                else {
                    return this.error(ErrorKind.UNCLOSED_TAG, createLocation(startPosition, this.clonePosition()));
                }
            }
            else {
                return this.error(ErrorKind.INVALID_TAG, createLocation(startPosition, this.clonePosition()));
            }
        };
        /**
         * This method assumes that the caller has peeked ahead for the first tag character.
         */
        Parser.prototype.parseTagName = function () {
            var startOffset = this.offset();
            this.bump(); // the first tag name character
            while (!this.isEOF() && _isPotentialElementNameChar(this.char())) {
                this.bump();
            }
            return this.message.slice(startOffset, this.offset());
        };
        Parser.prototype.parseLiteral = function (nestingLevel, parentArgType) {
            var start = this.clonePosition();
            var value = '';
            while (true) {
                var parseQuoteResult = this.tryParseQuote(parentArgType);
                if (parseQuoteResult) {
                    value += parseQuoteResult;
                    continue;
                }
                var parseUnquotedResult = this.tryParseUnquoted(nestingLevel, parentArgType);
                if (parseUnquotedResult) {
                    value += parseUnquotedResult;
                    continue;
                }
                var parseLeftAngleResult = this.tryParseLeftAngleBracket();
                if (parseLeftAngleResult) {
                    value += parseLeftAngleResult;
                    continue;
                }
                break;
            }
            var location = createLocation(start, this.clonePosition());
            return {
                val: { type: TYPE.literal, value: value, location: location },
                err: null,
            };
        };
        Parser.prototype.tryParseLeftAngleBracket = function () {
            if (!this.isEOF() &&
                this.char() === 60 /* `<` */ &&
                (this.ignoreTag ||
                    // If at the opening tag or closing tag position, bail.
                    !_isAlphaOrSlash(this.peek() || 0))) {
                this.bump(); // `<`
                return '<';
            }
            return null;
        };
        /**
         * Starting with ICU 4.8, an ASCII apostrophe only starts quoted text if it immediately precedes
         * a character that requires quoting (that is, "only where needed"), and works the same in
         * nested messages as on the top level of the pattern. The new behavior is otherwise compatible.
         */
        Parser.prototype.tryParseQuote = function (parentArgType) {
            if (this.isEOF() || this.char() !== 39 /* `'` */) {
                return null;
            }
            // Parse escaped char following the apostrophe, or early return if there is no escaped char.
            // Check if is valid escaped character
            switch (this.peek()) {
                case 39 /* `'` */:
                    // double quote, should return as a single quote.
                    this.bump();
                    this.bump();
                    return "'";
                // '{', '<', '>', '}'
                case 123:
                case 60:
                case 62:
                case 125:
                    break;
                case 35: // '#'
                    if (parentArgType === 'plural' || parentArgType === 'selectordinal') {
                        break;
                    }
                    return null;
                default:
                    return null;
            }
            this.bump(); // apostrophe
            var codePoints = [this.char()]; // escaped char
            this.bump();
            // read chars until the optional closing apostrophe is found
            while (!this.isEOF()) {
                var ch = this.char();
                if (ch === 39 /* `'` */) {
                    if (this.peek() === 39 /* `'` */) {
                        codePoints.push(39);
                        // Bump one more time because we need to skip 2 characters.
                        this.bump();
                    }
                    else {
                        // Optional closing apostrophe.
                        this.bump();
                        break;
                    }
                }
                else {
                    codePoints.push(ch);
                }
                this.bump();
            }
            return fromCodePoint.apply(void 0, codePoints);
        };
        Parser.prototype.tryParseUnquoted = function (nestingLevel, parentArgType) {
            if (this.isEOF()) {
                return null;
            }
            var ch = this.char();
            if (ch === 60 /* `<` */ ||
                ch === 123 /* `{` */ ||
                (ch === 35 /* `#` */ &&
                    (parentArgType === 'plural' || parentArgType === 'selectordinal')) ||
                (ch === 125 /* `}` */ && nestingLevel > 0)) {
                return null;
            }
            else {
                this.bump();
                return fromCodePoint(ch);
            }
        };
        Parser.prototype.parseArgument = function (nestingLevel, expectingCloseTag) {
            var openingBracePosition = this.clonePosition();
            this.bump(); // `{`
            this.bumpSpace();
            if (this.isEOF()) {
                return this.error(ErrorKind.EXPECT_ARGUMENT_CLOSING_BRACE, createLocation(openingBracePosition, this.clonePosition()));
            }
            if (this.char() === 125 /* `}` */) {
                this.bump();
                return this.error(ErrorKind.EMPTY_ARGUMENT, createLocation(openingBracePosition, this.clonePosition()));
            }
            // argument name
            var value = this.parseIdentifierIfPossible().value;
            if (!value) {
                return this.error(ErrorKind.MALFORMED_ARGUMENT, createLocation(openingBracePosition, this.clonePosition()));
            }
            this.bumpSpace();
            if (this.isEOF()) {
                return this.error(ErrorKind.EXPECT_ARGUMENT_CLOSING_BRACE, createLocation(openingBracePosition, this.clonePosition()));
            }
            switch (this.char()) {
                // Simple argument: `{name}`
                case 125 /* `}` */: {
                    this.bump(); // `}`
                    return {
                        val: {
                            type: TYPE.argument,
                            // value does not include the opening and closing braces.
                            value: value,
                            location: createLocation(openingBracePosition, this.clonePosition()),
                        },
                        err: null,
                    };
                }
                // Argument with options: `{name, format, ...}`
                case 44 /* `,` */: {
                    this.bump(); // `,`
                    this.bumpSpace();
                    if (this.isEOF()) {
                        return this.error(ErrorKind.EXPECT_ARGUMENT_CLOSING_BRACE, createLocation(openingBracePosition, this.clonePosition()));
                    }
                    return this.parseArgumentOptions(nestingLevel, expectingCloseTag, value, openingBracePosition);
                }
                default:
                    return this.error(ErrorKind.MALFORMED_ARGUMENT, createLocation(openingBracePosition, this.clonePosition()));
            }
        };
        /**
         * Advance the parser until the end of the identifier, if it is currently on
         * an identifier character. Return an empty string otherwise.
         */
        Parser.prototype.parseIdentifierIfPossible = function () {
            var startingPosition = this.clonePosition();
            var startOffset = this.offset();
            var value = matchIdentifierAtIndex(this.message, startOffset);
            var endOffset = startOffset + value.length;
            this.bumpTo(endOffset);
            var endPosition = this.clonePosition();
            var location = createLocation(startingPosition, endPosition);
            return { value: value, location: location };
        };
        Parser.prototype.parseArgumentOptions = function (nestingLevel, expectingCloseTag, value, openingBracePosition) {
            var _a;
            // Parse this range:
            // {name, type, style}
            //        ^---^
            var typeStartPosition = this.clonePosition();
            var argType = this.parseIdentifierIfPossible().value;
            var typeEndPosition = this.clonePosition();
            switch (argType) {
                case '':
                    // Expecting a style string number, date, time, plural, selectordinal, or select.
                    return this.error(ErrorKind.EXPECT_ARGUMENT_TYPE, createLocation(typeStartPosition, typeEndPosition));
                case 'number':
                case 'date':
                case 'time': {
                    // Parse this range:
                    // {name, number, style}
                    //              ^-------^
                    this.bumpSpace();
                    var styleAndLocation = null;
                    if (this.bumpIf(',')) {
                        this.bumpSpace();
                        var styleStartPosition = this.clonePosition();
                        var result = this.parseSimpleArgStyleIfPossible();
                        if (result.err) {
                            return result;
                        }
                        var style = trimEnd(result.val);
                        if (style.length === 0) {
                            return this.error(ErrorKind.EXPECT_ARGUMENT_STYLE, createLocation(this.clonePosition(), this.clonePosition()));
                        }
                        var styleLocation = createLocation(styleStartPosition, this.clonePosition());
                        styleAndLocation = { style: style, styleLocation: styleLocation };
                    }
                    var argCloseResult = this.tryParseArgumentClose(openingBracePosition);
                    if (argCloseResult.err) {
                        return argCloseResult;
                    }
                    var location_1 = createLocation(openingBracePosition, this.clonePosition());
                    // Extract style or skeleton
                    if (styleAndLocation && startsWith(styleAndLocation === null || styleAndLocation === void 0 ? void 0 : styleAndLocation.style, '::', 0)) {
                        // Skeleton starts with `::`.
                        var skeleton = trimStart(styleAndLocation.style.slice(2));
                        if (argType === 'number') {
                            var result = this.parseNumberSkeletonFromString(skeleton, styleAndLocation.styleLocation);
                            if (result.err) {
                                return result;
                            }
                            return {
                                val: { type: TYPE.number, value: value, location: location_1, style: result.val },
                                err: null,
                            };
                        }
                        else {
                            if (skeleton.length === 0) {
                                return this.error(ErrorKind.EXPECT_DATE_TIME_SKELETON, location_1);
                            }
                            var style = {
                                type: SKELETON_TYPE.dateTime,
                                pattern: skeleton,
                                location: styleAndLocation.styleLocation,
                                parsedOptions: this.shouldParseSkeletons
                                    ? parseDateTimeSkeleton(skeleton)
                                    : {},
                            };
                            var type = argType === 'date' ? TYPE.date : TYPE.time;
                            return {
                                val: { type: type, value: value, location: location_1, style: style },
                                err: null,
                            };
                        }
                    }
                    // Regular style or no style.
                    return {
                        val: {
                            type: argType === 'number'
                                ? TYPE.number
                                : argType === 'date'
                                    ? TYPE.date
                                    : TYPE.time,
                            value: value,
                            location: location_1,
                            style: (_a = styleAndLocation === null || styleAndLocation === void 0 ? void 0 : styleAndLocation.style) !== null && _a !== void 0 ? _a : null,
                        },
                        err: null,
                    };
                }
                case 'plural':
                case 'selectordinal':
                case 'select': {
                    // Parse this range:
                    // {name, plural, options}
                    //              ^---------^
                    var typeEndPosition_1 = this.clonePosition();
                    this.bumpSpace();
                    if (!this.bumpIf(',')) {
                        return this.error(ErrorKind.EXPECT_SELECT_ARGUMENT_OPTIONS, createLocation(typeEndPosition_1, __assign({}, typeEndPosition_1)));
                    }
                    this.bumpSpace();
                    // Parse offset:
                    // {name, plural, offset:1, options}
                    //                ^-----^
                    //
                    // or the first option:
                    //
                    // {name, plural, one {...} other {...}}
                    //                ^--^
                    var identifierAndLocation = this.parseIdentifierIfPossible();
                    var pluralOffset = 0;
                    if (argType !== 'select' && identifierAndLocation.value === 'offset') {
                        if (!this.bumpIf(':')) {
                            return this.error(ErrorKind.EXPECT_PLURAL_ARGUMENT_OFFSET_VALUE, createLocation(this.clonePosition(), this.clonePosition()));
                        }
                        this.bumpSpace();
                        var result = this.tryParseDecimalInteger(ErrorKind.EXPECT_PLURAL_ARGUMENT_OFFSET_VALUE, ErrorKind.INVALID_PLURAL_ARGUMENT_OFFSET_VALUE);
                        if (result.err) {
                            return result;
                        }
                        // Parse another identifier for option parsing
                        this.bumpSpace();
                        identifierAndLocation = this.parseIdentifierIfPossible();
                        pluralOffset = result.val;
                    }
                    var optionsResult = this.tryParsePluralOrSelectOptions(nestingLevel, argType, expectingCloseTag, identifierAndLocation);
                    if (optionsResult.err) {
                        return optionsResult;
                    }
                    var argCloseResult = this.tryParseArgumentClose(openingBracePosition);
                    if (argCloseResult.err) {
                        return argCloseResult;
                    }
                    var location_2 = createLocation(openingBracePosition, this.clonePosition());
                    if (argType === 'select') {
                        return {
                            val: {
                                type: TYPE.select,
                                value: value,
                                options: fromEntries(optionsResult.val),
                                location: location_2,
                            },
                            err: null,
                        };
                    }
                    else {
                        return {
                            val: {
                                type: TYPE.plural,
                                value: value,
                                options: fromEntries(optionsResult.val),
                                offset: pluralOffset,
                                pluralType: argType === 'plural' ? 'cardinal' : 'ordinal',
                                location: location_2,
                            },
                            err: null,
                        };
                    }
                }
                default:
                    return this.error(ErrorKind.INVALID_ARGUMENT_TYPE, createLocation(typeStartPosition, typeEndPosition));
            }
        };
        Parser.prototype.tryParseArgumentClose = function (openingBracePosition) {
            // Parse: {value, number, ::currency/GBP }
            //
            if (this.isEOF() || this.char() !== 125 /* `}` */) {
                return this.error(ErrorKind.EXPECT_ARGUMENT_CLOSING_BRACE, createLocation(openingBracePosition, this.clonePosition()));
            }
            this.bump(); // `}`
            return { val: true, err: null };
        };
        /**
         * See: https://github.com/unicode-org/icu/blob/af7ed1f6d2298013dc303628438ec4abe1f16479/icu4c/source/common/messagepattern.cpp#L659
         */
        Parser.prototype.parseSimpleArgStyleIfPossible = function () {
            var nestedBraces = 0;
            var startPosition = this.clonePosition();
            while (!this.isEOF()) {
                var ch = this.char();
                switch (ch) {
                    case 39 /* `'` */: {
                        // Treat apostrophe as quoting but include it in the style part.
                        // Find the end of the quoted literal text.
                        this.bump();
                        var apostrophePosition = this.clonePosition();
                        if (!this.bumpUntil("'")) {
                            return this.error(ErrorKind.UNCLOSED_QUOTE_IN_ARGUMENT_STYLE, createLocation(apostrophePosition, this.clonePosition()));
                        }
                        this.bump();
                        break;
                    }
                    case 123 /* `{` */: {
                        nestedBraces += 1;
                        this.bump();
                        break;
                    }
                    case 125 /* `}` */: {
                        if (nestedBraces > 0) {
                            nestedBraces -= 1;
                        }
                        else {
                            return {
                                val: this.message.slice(startPosition.offset, this.offset()),
                                err: null,
                            };
                        }
                        break;
                    }
                    default:
                        this.bump();
                        break;
                }
            }
            return {
                val: this.message.slice(startPosition.offset, this.offset()),
                err: null,
            };
        };
        Parser.prototype.parseNumberSkeletonFromString = function (skeleton, location) {
            var tokens = [];
            try {
                tokens = parseNumberSkeletonFromString(skeleton);
            }
            catch (e) {
                return this.error(ErrorKind.INVALID_NUMBER_SKELETON, location);
            }
            return {
                val: {
                    type: SKELETON_TYPE.number,
                    tokens: tokens,
                    location: location,
                    parsedOptions: this.shouldParseSkeletons
                        ? parseNumberSkeleton(tokens)
                        : {},
                },
                err: null,
            };
        };
        /**
         * @param nesting_level The current nesting level of messages.
         *     This can be positive when parsing message fragment in select or plural argument options.
         * @param parent_arg_type The parent argument's type.
         * @param parsed_first_identifier If provided, this is the first identifier-like selector of
         *     the argument. It is a by-product of a previous parsing attempt.
         * @param expecting_close_tag If true, this message is directly or indirectly nested inside
         *     between a pair of opening and closing tags. The nested message will not parse beyond
         *     the closing tag boundary.
         */
        Parser.prototype.tryParsePluralOrSelectOptions = function (nestingLevel, parentArgType, expectCloseTag, parsedFirstIdentifier) {
            var _a;
            var hasOtherClause = false;
            var options = [];
            var parsedSelectors = new Set();
            var selector = parsedFirstIdentifier.value, selectorLocation = parsedFirstIdentifier.location;
            // Parse:
            // one {one apple}
            // ^--^
            while (true) {
                if (selector.length === 0) {
                    var startPosition = this.clonePosition();
                    if (parentArgType !== 'select' && this.bumpIf('=')) {
                        // Try parse `={number}` selector
                        var result = this.tryParseDecimalInteger(ErrorKind.EXPECT_PLURAL_ARGUMENT_SELECTOR, ErrorKind.INVALID_PLURAL_ARGUMENT_SELECTOR);
                        if (result.err) {
                            return result;
                        }
                        selectorLocation = createLocation(startPosition, this.clonePosition());
                        selector = this.message.slice(startPosition.offset, this.offset());
                    }
                    else {
                        break;
                    }
                }
                // Duplicate selector clauses
                if (parsedSelectors.has(selector)) {
                    return this.error(parentArgType === 'select'
                        ? ErrorKind.DUPLICATE_SELECT_ARGUMENT_SELECTOR
                        : ErrorKind.DUPLICATE_PLURAL_ARGUMENT_SELECTOR, selectorLocation);
                }
                if (selector === 'other') {
                    hasOtherClause = true;
                }
                // Parse:
                // one {one apple}
                //     ^----------^
                this.bumpSpace();
                var openingBracePosition = this.clonePosition();
                if (!this.bumpIf('{')) {
                    return this.error(parentArgType === 'select'
                        ? ErrorKind.EXPECT_SELECT_ARGUMENT_SELECTOR_FRAGMENT
                        : ErrorKind.EXPECT_PLURAL_ARGUMENT_SELECTOR_FRAGMENT, createLocation(this.clonePosition(), this.clonePosition()));
                }
                var fragmentResult = this.parseMessage(nestingLevel + 1, parentArgType, expectCloseTag);
                if (fragmentResult.err) {
                    return fragmentResult;
                }
                var argCloseResult = this.tryParseArgumentClose(openingBracePosition);
                if (argCloseResult.err) {
                    return argCloseResult;
                }
                options.push([
                    selector,
                    {
                        value: fragmentResult.val,
                        location: createLocation(openingBracePosition, this.clonePosition()),
                    },
                ]);
                // Keep track of the existing selectors
                parsedSelectors.add(selector);
                // Prep next selector clause.
                this.bumpSpace();
                (_a = this.parseIdentifierIfPossible(), selector = _a.value, selectorLocation = _a.location);
            }
            if (options.length === 0) {
                return this.error(parentArgType === 'select'
                    ? ErrorKind.EXPECT_SELECT_ARGUMENT_SELECTOR
                    : ErrorKind.EXPECT_PLURAL_ARGUMENT_SELECTOR, createLocation(this.clonePosition(), this.clonePosition()));
            }
            if (this.requiresOtherClause && !hasOtherClause) {
                return this.error(ErrorKind.MISSING_OTHER_CLAUSE, createLocation(this.clonePosition(), this.clonePosition()));
            }
            return { val: options, err: null };
        };
        Parser.prototype.tryParseDecimalInteger = function (expectNumberError, invalidNumberError) {
            var sign = 1;
            var startingPosition = this.clonePosition();
            if (this.bumpIf('+')) ;
            else if (this.bumpIf('-')) {
                sign = -1;
            }
            var hasDigits = false;
            var decimal = 0;
            while (!this.isEOF()) {
                var ch = this.char();
                if (ch >= 48 /* `0` */ && ch <= 57 /* `9` */) {
                    hasDigits = true;
                    decimal = decimal * 10 + (ch - 48);
                    this.bump();
                }
                else {
                    break;
                }
            }
            var location = createLocation(startingPosition, this.clonePosition());
            if (!hasDigits) {
                return this.error(expectNumberError, location);
            }
            decimal *= sign;
            if (!isSafeInteger(decimal)) {
                return this.error(invalidNumberError, location);
            }
            return { val: decimal, err: null };
        };
        Parser.prototype.offset = function () {
            return this.position.offset;
        };
        Parser.prototype.isEOF = function () {
            return this.offset() === this.message.length;
        };
        Parser.prototype.clonePosition = function () {
            // This is much faster than `Object.assign` or spread.
            return {
                offset: this.position.offset,
                line: this.position.line,
                column: this.position.column,
            };
        };
        /**
         * Return the code point at the current position of the parser.
         * Throws if the index is out of bound.
         */
        Parser.prototype.char = function () {
            var offset = this.position.offset;
            if (offset >= this.message.length) {
                throw Error('out of bound');
            }
            var code = codePointAt(this.message, offset);
            if (code === undefined) {
                throw Error("Offset " + offset + " is at invalid UTF-16 code unit boundary");
            }
            return code;
        };
        Parser.prototype.error = function (kind, location) {
            return {
                val: null,
                err: {
                    kind: kind,
                    message: this.message,
                    location: location,
                },
            };
        };
        /** Bump the parser to the next UTF-16 code unit. */
        Parser.prototype.bump = function () {
            if (this.isEOF()) {
                return;
            }
            var code = this.char();
            if (code === 10 /* '\n' */) {
                this.position.line += 1;
                this.position.column = 1;
                this.position.offset += 1;
            }
            else {
                this.position.column += 1;
                // 0 ~ 0x10000 -> unicode BMP, otherwise skip the surrogate pair.
                this.position.offset += code < 0x10000 ? 1 : 2;
            }
        };
        /**
         * If the substring starting at the current position of the parser has
         * the given prefix, then bump the parser to the character immediately
         * following the prefix and return true. Otherwise, don't bump the parser
         * and return false.
         */
        Parser.prototype.bumpIf = function (prefix) {
            if (startsWith(this.message, prefix, this.offset())) {
                for (var i = 0; i < prefix.length; i++) {
                    this.bump();
                }
                return true;
            }
            return false;
        };
        /**
         * Bump the parser until the pattern character is found and return `true`.
         * Otherwise bump to the end of the file and return `false`.
         */
        Parser.prototype.bumpUntil = function (pattern) {
            var currentOffset = this.offset();
            var index = this.message.indexOf(pattern, currentOffset);
            if (index >= 0) {
                this.bumpTo(index);
                return true;
            }
            else {
                this.bumpTo(this.message.length);
                return false;
            }
        };
        /**
         * Bump the parser to the target offset.
         * If target offset is beyond the end of the input, bump the parser to the end of the input.
         */
        Parser.prototype.bumpTo = function (targetOffset) {
            if (this.offset() > targetOffset) {
                throw Error("targetOffset " + targetOffset + " must be greater than or equal to the current offset " + this.offset());
            }
            targetOffset = Math.min(targetOffset, this.message.length);
            while (true) {
                var offset = this.offset();
                if (offset === targetOffset) {
                    break;
                }
                if (offset > targetOffset) {
                    throw Error("targetOffset " + targetOffset + " is at invalid UTF-16 code unit boundary");
                }
                this.bump();
                if (this.isEOF()) {
                    break;
                }
            }
        };
        /** advance the parser through all whitespace to the next non-whitespace code unit. */
        Parser.prototype.bumpSpace = function () {
            while (!this.isEOF() && _isWhiteSpace(this.char())) {
                this.bump();
            }
        };
        /**
         * Peek at the *next* Unicode codepoint in the input without advancing the parser.
         * If the input has been exhausted, then this returns null.
         */
        Parser.prototype.peek = function () {
            if (this.isEOF()) {
                return null;
            }
            var code = this.char();
            var offset = this.offset();
            var nextCode = this.message.charCodeAt(offset + (code >= 0x10000 ? 2 : 1));
            return nextCode !== null && nextCode !== void 0 ? nextCode : null;
        };
        return Parser;
    }());
    /**
     * This check if codepoint is alphabet (lower & uppercase)
     * @param codepoint
     * @returns
     */
    function _isAlpha(codepoint) {
        return ((codepoint >= 97 && codepoint <= 122) ||
            (codepoint >= 65 && codepoint <= 90));
    }
    function _isAlphaOrSlash(codepoint) {
        return _isAlpha(codepoint) || codepoint === 47; /* '/' */
    }
    /** See `parseTag` function docs. */
    function _isPotentialElementNameChar(c) {
        return (c === 45 /* '-' */ ||
            c === 46 /* '.' */ ||
            (c >= 48 && c <= 57) /* 0..9 */ ||
            c === 95 /* '_' */ ||
            (c >= 97 && c <= 122) /** a..z */ ||
            (c >= 65 && c <= 90) /* A..Z */ ||
            c == 0xb7 ||
            (c >= 0xc0 && c <= 0xd6) ||
            (c >= 0xd8 && c <= 0xf6) ||
            (c >= 0xf8 && c <= 0x37d) ||
            (c >= 0x37f && c <= 0x1fff) ||
            (c >= 0x200c && c <= 0x200d) ||
            (c >= 0x203f && c <= 0x2040) ||
            (c >= 0x2070 && c <= 0x218f) ||
            (c >= 0x2c00 && c <= 0x2fef) ||
            (c >= 0x3001 && c <= 0xd7ff) ||
            (c >= 0xf900 && c <= 0xfdcf) ||
            (c >= 0xfdf0 && c <= 0xfffd) ||
            (c >= 0x10000 && c <= 0xeffff));
    }
    /**
     * Code point equivalent of regex `\p{White_Space}`.
     * From: https://www.unicode.org/Public/UCD/latest/ucd/PropList.txt
     */
    function _isWhiteSpace(c) {
        return ((c >= 0x0009 && c <= 0x000d) ||
            c === 0x0020 ||
            c === 0x0085 ||
            (c >= 0x200e && c <= 0x200f) ||
            c === 0x2028 ||
            c === 0x2029);
    }
    /**
     * Code point equivalent of regex `\p{Pattern_Syntax}`.
     * See https://www.unicode.org/Public/UCD/latest/ucd/PropList.txt
     */
    function _isPatternSyntax(c) {
        return ((c >= 0x0021 && c <= 0x0023) ||
            c === 0x0024 ||
            (c >= 0x0025 && c <= 0x0027) ||
            c === 0x0028 ||
            c === 0x0029 ||
            c === 0x002a ||
            c === 0x002b ||
            c === 0x002c ||
            c === 0x002d ||
            (c >= 0x002e && c <= 0x002f) ||
            (c >= 0x003a && c <= 0x003b) ||
            (c >= 0x003c && c <= 0x003e) ||
            (c >= 0x003f && c <= 0x0040) ||
            c === 0x005b ||
            c === 0x005c ||
            c === 0x005d ||
            c === 0x005e ||
            c === 0x0060 ||
            c === 0x007b ||
            c === 0x007c ||
            c === 0x007d ||
            c === 0x007e ||
            c === 0x00a1 ||
            (c >= 0x00a2 && c <= 0x00a5) ||
            c === 0x00a6 ||
            c === 0x00a7 ||
            c === 0x00a9 ||
            c === 0x00ab ||
            c === 0x00ac ||
            c === 0x00ae ||
            c === 0x00b0 ||
            c === 0x00b1 ||
            c === 0x00b6 ||
            c === 0x00bb ||
            c === 0x00bf ||
            c === 0x00d7 ||
            c === 0x00f7 ||
            (c >= 0x2010 && c <= 0x2015) ||
            (c >= 0x2016 && c <= 0x2017) ||
            c === 0x2018 ||
            c === 0x2019 ||
            c === 0x201a ||
            (c >= 0x201b && c <= 0x201c) ||
            c === 0x201d ||
            c === 0x201e ||
            c === 0x201f ||
            (c >= 0x2020 && c <= 0x2027) ||
            (c >= 0x2030 && c <= 0x2038) ||
            c === 0x2039 ||
            c === 0x203a ||
            (c >= 0x203b && c <= 0x203e) ||
            (c >= 0x2041 && c <= 0x2043) ||
            c === 0x2044 ||
            c === 0x2045 ||
            c === 0x2046 ||
            (c >= 0x2047 && c <= 0x2051) ||
            c === 0x2052 ||
            c === 0x2053 ||
            (c >= 0x2055 && c <= 0x205e) ||
            (c >= 0x2190 && c <= 0x2194) ||
            (c >= 0x2195 && c <= 0x2199) ||
            (c >= 0x219a && c <= 0x219b) ||
            (c >= 0x219c && c <= 0x219f) ||
            c === 0x21a0 ||
            (c >= 0x21a1 && c <= 0x21a2) ||
            c === 0x21a3 ||
            (c >= 0x21a4 && c <= 0x21a5) ||
            c === 0x21a6 ||
            (c >= 0x21a7 && c <= 0x21ad) ||
            c === 0x21ae ||
            (c >= 0x21af && c <= 0x21cd) ||
            (c >= 0x21ce && c <= 0x21cf) ||
            (c >= 0x21d0 && c <= 0x21d1) ||
            c === 0x21d2 ||
            c === 0x21d3 ||
            c === 0x21d4 ||
            (c >= 0x21d5 && c <= 0x21f3) ||
            (c >= 0x21f4 && c <= 0x22ff) ||
            (c >= 0x2300 && c <= 0x2307) ||
            c === 0x2308 ||
            c === 0x2309 ||
            c === 0x230a ||
            c === 0x230b ||
            (c >= 0x230c && c <= 0x231f) ||
            (c >= 0x2320 && c <= 0x2321) ||
            (c >= 0x2322 && c <= 0x2328) ||
            c === 0x2329 ||
            c === 0x232a ||
            (c >= 0x232b && c <= 0x237b) ||
            c === 0x237c ||
            (c >= 0x237d && c <= 0x239a) ||
            (c >= 0x239b && c <= 0x23b3) ||
            (c >= 0x23b4 && c <= 0x23db) ||
            (c >= 0x23dc && c <= 0x23e1) ||
            (c >= 0x23e2 && c <= 0x2426) ||
            (c >= 0x2427 && c <= 0x243f) ||
            (c >= 0x2440 && c <= 0x244a) ||
            (c >= 0x244b && c <= 0x245f) ||
            (c >= 0x2500 && c <= 0x25b6) ||
            c === 0x25b7 ||
            (c >= 0x25b8 && c <= 0x25c0) ||
            c === 0x25c1 ||
            (c >= 0x25c2 && c <= 0x25f7) ||
            (c >= 0x25f8 && c <= 0x25ff) ||
            (c >= 0x2600 && c <= 0x266e) ||
            c === 0x266f ||
            (c >= 0x2670 && c <= 0x2767) ||
            c === 0x2768 ||
            c === 0x2769 ||
            c === 0x276a ||
            c === 0x276b ||
            c === 0x276c ||
            c === 0x276d ||
            c === 0x276e ||
            c === 0x276f ||
            c === 0x2770 ||
            c === 0x2771 ||
            c === 0x2772 ||
            c === 0x2773 ||
            c === 0x2774 ||
            c === 0x2775 ||
            (c >= 0x2794 && c <= 0x27bf) ||
            (c >= 0x27c0 && c <= 0x27c4) ||
            c === 0x27c5 ||
            c === 0x27c6 ||
            (c >= 0x27c7 && c <= 0x27e5) ||
            c === 0x27e6 ||
            c === 0x27e7 ||
            c === 0x27e8 ||
            c === 0x27e9 ||
            c === 0x27ea ||
            c === 0x27eb ||
            c === 0x27ec ||
            c === 0x27ed ||
            c === 0x27ee ||
            c === 0x27ef ||
            (c >= 0x27f0 && c <= 0x27ff) ||
            (c >= 0x2800 && c <= 0x28ff) ||
            (c >= 0x2900 && c <= 0x2982) ||
            c === 0x2983 ||
            c === 0x2984 ||
            c === 0x2985 ||
            c === 0x2986 ||
            c === 0x2987 ||
            c === 0x2988 ||
            c === 0x2989 ||
            c === 0x298a ||
            c === 0x298b ||
            c === 0x298c ||
            c === 0x298d ||
            c === 0x298e ||
            c === 0x298f ||
            c === 0x2990 ||
            c === 0x2991 ||
            c === 0x2992 ||
            c === 0x2993 ||
            c === 0x2994 ||
            c === 0x2995 ||
            c === 0x2996 ||
            c === 0x2997 ||
            c === 0x2998 ||
            (c >= 0x2999 && c <= 0x29d7) ||
            c === 0x29d8 ||
            c === 0x29d9 ||
            c === 0x29da ||
            c === 0x29db ||
            (c >= 0x29dc && c <= 0x29fb) ||
            c === 0x29fc ||
            c === 0x29fd ||
            (c >= 0x29fe && c <= 0x2aff) ||
            (c >= 0x2b00 && c <= 0x2b2f) ||
            (c >= 0x2b30 && c <= 0x2b44) ||
            (c >= 0x2b45 && c <= 0x2b46) ||
            (c >= 0x2b47 && c <= 0x2b4c) ||
            (c >= 0x2b4d && c <= 0x2b73) ||
            (c >= 0x2b74 && c <= 0x2b75) ||
            (c >= 0x2b76 && c <= 0x2b95) ||
            c === 0x2b96 ||
            (c >= 0x2b97 && c <= 0x2bff) ||
            (c >= 0x2e00 && c <= 0x2e01) ||
            c === 0x2e02 ||
            c === 0x2e03 ||
            c === 0x2e04 ||
            c === 0x2e05 ||
            (c >= 0x2e06 && c <= 0x2e08) ||
            c === 0x2e09 ||
            c === 0x2e0a ||
            c === 0x2e0b ||
            c === 0x2e0c ||
            c === 0x2e0d ||
            (c >= 0x2e0e && c <= 0x2e16) ||
            c === 0x2e17 ||
            (c >= 0x2e18 && c <= 0x2e19) ||
            c === 0x2e1a ||
            c === 0x2e1b ||
            c === 0x2e1c ||
            c === 0x2e1d ||
            (c >= 0x2e1e && c <= 0x2e1f) ||
            c === 0x2e20 ||
            c === 0x2e21 ||
            c === 0x2e22 ||
            c === 0x2e23 ||
            c === 0x2e24 ||
            c === 0x2e25 ||
            c === 0x2e26 ||
            c === 0x2e27 ||
            c === 0x2e28 ||
            c === 0x2e29 ||
            (c >= 0x2e2a && c <= 0x2e2e) ||
            c === 0x2e2f ||
            (c >= 0x2e30 && c <= 0x2e39) ||
            (c >= 0x2e3a && c <= 0x2e3b) ||
            (c >= 0x2e3c && c <= 0x2e3f) ||
            c === 0x2e40 ||
            c === 0x2e41 ||
            c === 0x2e42 ||
            (c >= 0x2e43 && c <= 0x2e4f) ||
            (c >= 0x2e50 && c <= 0x2e51) ||
            c === 0x2e52 ||
            (c >= 0x2e53 && c <= 0x2e7f) ||
            (c >= 0x3001 && c <= 0x3003) ||
            c === 0x3008 ||
            c === 0x3009 ||
            c === 0x300a ||
            c === 0x300b ||
            c === 0x300c ||
            c === 0x300d ||
            c === 0x300e ||
            c === 0x300f ||
            c === 0x3010 ||
            c === 0x3011 ||
            (c >= 0x3012 && c <= 0x3013) ||
            c === 0x3014 ||
            c === 0x3015 ||
            c === 0x3016 ||
            c === 0x3017 ||
            c === 0x3018 ||
            c === 0x3019 ||
            c === 0x301a ||
            c === 0x301b ||
            c === 0x301c ||
            c === 0x301d ||
            (c >= 0x301e && c <= 0x301f) ||
            c === 0x3020 ||
            c === 0x3030 ||
            c === 0xfd3e ||
            c === 0xfd3f ||
            (c >= 0xfe45 && c <= 0xfe46));
    }

    function pruneLocation(els) {
        els.forEach(function (el) {
            delete el.location;
            if (isSelectElement(el) || isPluralElement(el)) {
                for (var k in el.options) {
                    delete el.options[k].location;
                    pruneLocation(el.options[k].value);
                }
            }
            else if (isNumberElement(el) && isNumberSkeleton(el.style)) {
                delete el.style.location;
            }
            else if ((isDateElement(el) || isTimeElement(el)) &&
                isDateTimeSkeleton(el.style)) {
                delete el.style.location;
            }
            else if (isTagElement(el)) {
                pruneLocation(el.children);
            }
        });
    }
    function parse(message, opts) {
        if (opts === void 0) { opts = {}; }
        opts = __assign({ shouldParseSkeletons: true, requiresOtherClause: true }, opts);
        var result = new Parser(message, opts).parse();
        if (result.err) {
            var error = SyntaxError(ErrorKind[result.err.kind]);
            // @ts-expect-error Assign to error object
            error.location = result.err.location;
            // @ts-expect-error Assign to error object
            error.originalMessage = result.err.message;
            throw error;
        }
        if (!(opts === null || opts === void 0 ? void 0 : opts.captureLocation)) {
            pruneLocation(result.val);
        }
        return result.val;
    }

    //
    // Main
    //
    function memoize(fn, options) {
        var cache = options && options.cache ? options.cache : cacheDefault;
        var serializer = options && options.serializer ? options.serializer : serializerDefault;
        var strategy = options && options.strategy ? options.strategy : strategyDefault;
        return strategy(fn, {
            cache: cache,
            serializer: serializer,
        });
    }
    //
    // Strategy
    //
    function isPrimitive(value) {
        return (value == null || typeof value === 'number' || typeof value === 'boolean'); // || typeof value === "string" 'unsafe' primitive for our needs
    }
    function monadic(fn, cache, serializer, arg) {
        var cacheKey = isPrimitive(arg) ? arg : serializer(arg);
        var computedValue = cache.get(cacheKey);
        if (typeof computedValue === 'undefined') {
            computedValue = fn.call(this, arg);
            cache.set(cacheKey, computedValue);
        }
        return computedValue;
    }
    function variadic(fn, cache, serializer) {
        var args = Array.prototype.slice.call(arguments, 3);
        var cacheKey = serializer(args);
        var computedValue = cache.get(cacheKey);
        if (typeof computedValue === 'undefined') {
            computedValue = fn.apply(this, args);
            cache.set(cacheKey, computedValue);
        }
        return computedValue;
    }
    function assemble(fn, context, strategy, cache, serialize) {
        return strategy.bind(context, fn, cache, serialize);
    }
    function strategyDefault(fn, options) {
        var strategy = fn.length === 1 ? monadic : variadic;
        return assemble(fn, this, strategy, options.cache.create(), options.serializer);
    }
    function strategyVariadic(fn, options) {
        return assemble(fn, this, variadic, options.cache.create(), options.serializer);
    }
    function strategyMonadic(fn, options) {
        return assemble(fn, this, monadic, options.cache.create(), options.serializer);
    }
    //
    // Serializer
    //
    var serializerDefault = function () {
        return JSON.stringify(arguments);
    };
    //
    // Cache
    //
    function ObjectWithoutPrototypeCache() {
        this.cache = Object.create(null);
    }
    ObjectWithoutPrototypeCache.prototype.has = function (key) {
        return key in this.cache;
    };
    ObjectWithoutPrototypeCache.prototype.get = function (key) {
        return this.cache[key];
    };
    ObjectWithoutPrototypeCache.prototype.set = function (key, value) {
        this.cache[key] = value;
    };
    var cacheDefault = {
        create: function create() {
            // @ts-ignore
            return new ObjectWithoutPrototypeCache();
        },
    };
    var strategies = {
        variadic: strategyVariadic,
        monadic: strategyMonadic,
    };

    var ErrorCode;
    (function (ErrorCode) {
        // When we have a placeholder but no value to format
        ErrorCode["MISSING_VALUE"] = "MISSING_VALUE";
        // When value supplied is invalid
        ErrorCode["INVALID_VALUE"] = "INVALID_VALUE";
        // When we need specific Intl API but it's not available
        ErrorCode["MISSING_INTL_API"] = "MISSING_INTL_API";
    })(ErrorCode || (ErrorCode = {}));
    var FormatError = /** @class */ (function (_super) {
        __extends(FormatError, _super);
        function FormatError(msg, code, originalMessage) {
            var _this = _super.call(this, msg) || this;
            _this.code = code;
            _this.originalMessage = originalMessage;
            return _this;
        }
        FormatError.prototype.toString = function () {
            return "[formatjs Error: " + this.code + "] " + this.message;
        };
        return FormatError;
    }(Error));
    var InvalidValueError = /** @class */ (function (_super) {
        __extends(InvalidValueError, _super);
        function InvalidValueError(variableId, value, options, originalMessage) {
            return _super.call(this, "Invalid values for \"" + variableId + "\": \"" + value + "\". Options are \"" + Object.keys(options).join('", "') + "\"", ErrorCode.INVALID_VALUE, originalMessage) || this;
        }
        return InvalidValueError;
    }(FormatError));
    var InvalidValueTypeError = /** @class */ (function (_super) {
        __extends(InvalidValueTypeError, _super);
        function InvalidValueTypeError(value, type, originalMessage) {
            return _super.call(this, "Value for \"" + value + "\" must be of type " + type, ErrorCode.INVALID_VALUE, originalMessage) || this;
        }
        return InvalidValueTypeError;
    }(FormatError));
    var MissingValueError = /** @class */ (function (_super) {
        __extends(MissingValueError, _super);
        function MissingValueError(variableId, originalMessage) {
            return _super.call(this, "The intl string context variable \"" + variableId + "\" was not provided to the string \"" + originalMessage + "\"", ErrorCode.MISSING_VALUE, originalMessage) || this;
        }
        return MissingValueError;
    }(FormatError));

    var PART_TYPE;
    (function (PART_TYPE) {
        PART_TYPE[PART_TYPE["literal"] = 0] = "literal";
        PART_TYPE[PART_TYPE["object"] = 1] = "object";
    })(PART_TYPE || (PART_TYPE = {}));
    function mergeLiteral(parts) {
        if (parts.length < 2) {
            return parts;
        }
        return parts.reduce(function (all, part) {
            var lastPart = all[all.length - 1];
            if (!lastPart ||
                lastPart.type !== PART_TYPE.literal ||
                part.type !== PART_TYPE.literal) {
                all.push(part);
            }
            else {
                lastPart.value += part.value;
            }
            return all;
        }, []);
    }
    function isFormatXMLElementFn(el) {
        return typeof el === 'function';
    }
    // TODO(skeleton): add skeleton support
    function formatToParts(els, locales, formatters, formats, values, currentPluralValue, 
    // For debugging
    originalMessage) {
        // Hot path for straight simple msg translations
        if (els.length === 1 && isLiteralElement(els[0])) {
            return [
                {
                    type: PART_TYPE.literal,
                    value: els[0].value,
                },
            ];
        }
        var result = [];
        for (var _i = 0, els_1 = els; _i < els_1.length; _i++) {
            var el = els_1[_i];
            // Exit early for string parts.
            if (isLiteralElement(el)) {
                result.push({
                    type: PART_TYPE.literal,
                    value: el.value,
                });
                continue;
            }
            // TODO: should this part be literal type?
            // Replace `#` in plural rules with the actual numeric value.
            if (isPoundElement(el)) {
                if (typeof currentPluralValue === 'number') {
                    result.push({
                        type: PART_TYPE.literal,
                        value: formatters.getNumberFormat(locales).format(currentPluralValue),
                    });
                }
                continue;
            }
            var varName = el.value;
            // Enforce that all required values are provided by the caller.
            if (!(values && varName in values)) {
                throw new MissingValueError(varName, originalMessage);
            }
            var value = values[varName];
            if (isArgumentElement(el)) {
                if (!value || typeof value === 'string' || typeof value === 'number') {
                    value =
                        typeof value === 'string' || typeof value === 'number'
                            ? String(value)
                            : '';
                }
                result.push({
                    type: typeof value === 'string' ? PART_TYPE.literal : PART_TYPE.object,
                    value: value,
                });
                continue;
            }
            // Recursively format plural and select parts' option — which can be a
            // nested pattern structure. The choosing of the option to use is
            // abstracted-by and delegated-to the part helper object.
            if (isDateElement(el)) {
                var style = typeof el.style === 'string'
                    ? formats.date[el.style]
                    : isDateTimeSkeleton(el.style)
                        ? el.style.parsedOptions
                        : undefined;
                result.push({
                    type: PART_TYPE.literal,
                    value: formatters
                        .getDateTimeFormat(locales, style)
                        .format(value),
                });
                continue;
            }
            if (isTimeElement(el)) {
                var style = typeof el.style === 'string'
                    ? formats.time[el.style]
                    : isDateTimeSkeleton(el.style)
                        ? el.style.parsedOptions
                        : undefined;
                result.push({
                    type: PART_TYPE.literal,
                    value: formatters
                        .getDateTimeFormat(locales, style)
                        .format(value),
                });
                continue;
            }
            if (isNumberElement(el)) {
                var style = typeof el.style === 'string'
                    ? formats.number[el.style]
                    : isNumberSkeleton(el.style)
                        ? el.style.parsedOptions
                        : undefined;
                if (style && style.scale) {
                    value =
                        value *
                            (style.scale || 1);
                }
                result.push({
                    type: PART_TYPE.literal,
                    value: formatters
                        .getNumberFormat(locales, style)
                        .format(value),
                });
                continue;
            }
            if (isTagElement(el)) {
                var children = el.children, value_1 = el.value;
                var formatFn = values[value_1];
                if (!isFormatXMLElementFn(formatFn)) {
                    throw new InvalidValueTypeError(value_1, 'function', originalMessage);
                }
                var parts = formatToParts(children, locales, formatters, formats, values, currentPluralValue);
                var chunks = formatFn(parts.map(function (p) { return p.value; }));
                if (!Array.isArray(chunks)) {
                    chunks = [chunks];
                }
                result.push.apply(result, chunks.map(function (c) {
                    return {
                        type: typeof c === 'string' ? PART_TYPE.literal : PART_TYPE.object,
                        value: c,
                    };
                }));
            }
            if (isSelectElement(el)) {
                var opt = el.options[value] || el.options.other;
                if (!opt) {
                    throw new InvalidValueError(el.value, value, Object.keys(el.options), originalMessage);
                }
                result.push.apply(result, formatToParts(opt.value, locales, formatters, formats, values));
                continue;
            }
            if (isPluralElement(el)) {
                var opt = el.options["=" + value];
                if (!opt) {
                    if (!Intl.PluralRules) {
                        throw new FormatError("Intl.PluralRules is not available in this environment.\nTry polyfilling it using \"@formatjs/intl-pluralrules\"\n", ErrorCode.MISSING_INTL_API, originalMessage);
                    }
                    var rule = formatters
                        .getPluralRules(locales, { type: el.pluralType })
                        .select(value - (el.offset || 0));
                    opt = el.options[rule] || el.options.other;
                }
                if (!opt) {
                    throw new InvalidValueError(el.value, value, Object.keys(el.options), originalMessage);
                }
                result.push.apply(result, formatToParts(opt.value, locales, formatters, formats, values, value - (el.offset || 0)));
                continue;
            }
        }
        return mergeLiteral(result);
    }

    /*
    Copyright (c) 2014, Yahoo! Inc. All rights reserved.
    Copyrights licensed under the New BSD License.
    See the accompanying LICENSE file for terms.
    */
    // -- MessageFormat --------------------------------------------------------
    function mergeConfig(c1, c2) {
        if (!c2) {
            return c1;
        }
        return __assign(__assign(__assign({}, (c1 || {})), (c2 || {})), Object.keys(c1).reduce(function (all, k) {
            all[k] = __assign(__assign({}, c1[k]), (c2[k] || {}));
            return all;
        }, {}));
    }
    function mergeConfigs(defaultConfig, configs) {
        if (!configs) {
            return defaultConfig;
        }
        return Object.keys(defaultConfig).reduce(function (all, k) {
            all[k] = mergeConfig(defaultConfig[k], configs[k]);
            return all;
        }, __assign({}, defaultConfig));
    }
    function createFastMemoizeCache(store) {
        return {
            create: function () {
                return {
                    has: function (key) {
                        return key in store;
                    },
                    get: function (key) {
                        return store[key];
                    },
                    set: function (key, value) {
                        store[key] = value;
                    },
                };
            },
        };
    }
    function createDefaultFormatters(cache) {
        if (cache === void 0) { cache = {
            number: {},
            dateTime: {},
            pluralRules: {},
        }; }
        return {
            getNumberFormat: memoize(function () {
                var _a;
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                return new ((_a = Intl.NumberFormat).bind.apply(_a, __spreadArray([void 0], args)))();
            }, {
                cache: createFastMemoizeCache(cache.number),
                strategy: strategies.variadic,
            }),
            getDateTimeFormat: memoize(function () {
                var _a;
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                return new ((_a = Intl.DateTimeFormat).bind.apply(_a, __spreadArray([void 0], args)))();
            }, {
                cache: createFastMemoizeCache(cache.dateTime),
                strategy: strategies.variadic,
            }),
            getPluralRules: memoize(function () {
                var _a;
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i] = arguments[_i];
                }
                return new ((_a = Intl.PluralRules).bind.apply(_a, __spreadArray([void 0], args)))();
            }, {
                cache: createFastMemoizeCache(cache.pluralRules),
                strategy: strategies.variadic,
            }),
        };
    }
    var IntlMessageFormat = /** @class */ (function () {
        function IntlMessageFormat(message, locales, overrideFormats, opts) {
            var _this = this;
            if (locales === void 0) { locales = IntlMessageFormat.defaultLocale; }
            this.formatterCache = {
                number: {},
                dateTime: {},
                pluralRules: {},
            };
            this.format = function (values) {
                var parts = _this.formatToParts(values);
                // Hot path for straight simple msg translations
                if (parts.length === 1) {
                    return parts[0].value;
                }
                var result = parts.reduce(function (all, part) {
                    if (!all.length ||
                        part.type !== PART_TYPE.literal ||
                        typeof all[all.length - 1] !== 'string') {
                        all.push(part.value);
                    }
                    else {
                        all[all.length - 1] += part.value;
                    }
                    return all;
                }, []);
                if (result.length <= 1) {
                    return result[0] || '';
                }
                return result;
            };
            this.formatToParts = function (values) {
                return formatToParts(_this.ast, _this.locales, _this.formatters, _this.formats, values, undefined, _this.message);
            };
            this.resolvedOptions = function () { return ({
                locale: Intl.NumberFormat.supportedLocalesOf(_this.locales)[0],
            }); };
            this.getAst = function () { return _this.ast; };
            if (typeof message === 'string') {
                this.message = message;
                if (!IntlMessageFormat.__parse) {
                    throw new TypeError('IntlMessageFormat.__parse must be set to process `message` of type `string`');
                }
                // Parse string messages into an AST.
                this.ast = IntlMessageFormat.__parse(message, {
                    ignoreTag: opts === null || opts === void 0 ? void 0 : opts.ignoreTag,
                });
            }
            else {
                this.ast = message;
            }
            if (!Array.isArray(this.ast)) {
                throw new TypeError('A message must be provided as a String or AST.');
            }
            // Creates a new object with the specified `formats` merged with the default
            // formats.
            this.formats = mergeConfigs(IntlMessageFormat.formats, overrideFormats);
            // Defined first because it's used to build the format pattern.
            this.locales = locales;
            this.formatters =
                (opts && opts.formatters) || createDefaultFormatters(this.formatterCache);
        }
        Object.defineProperty(IntlMessageFormat, "defaultLocale", {
            get: function () {
                if (!IntlMessageFormat.memoizedDefaultLocale) {
                    IntlMessageFormat.memoizedDefaultLocale =
                        new Intl.NumberFormat().resolvedOptions().locale;
                }
                return IntlMessageFormat.memoizedDefaultLocale;
            },
            enumerable: false,
            configurable: true
        });
        IntlMessageFormat.memoizedDefaultLocale = null;
        IntlMessageFormat.__parse = parse;
        // Default format options used as the prototype of the `formats` provided to the
        // constructor. These are used when constructing the internal Intl.NumberFormat
        // and Intl.DateTimeFormat instances.
        IntlMessageFormat.formats = {
            number: {
                integer: {
                    maximumFractionDigits: 0,
                },
                currency: {
                    style: 'currency',
                },
                percent: {
                    style: 'percent',
                },
            },
            date: {
                short: {
                    month: 'numeric',
                    day: 'numeric',
                    year: '2-digit',
                },
                medium: {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                },
                long: {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                },
                full: {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                },
            },
            time: {
                short: {
                    hour: 'numeric',
                    minute: 'numeric',
                },
                medium: {
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric',
                },
                long: {
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric',
                    timeZoneName: 'short',
                },
                full: {
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric',
                    timeZoneName: 'short',
                },
            },
        };
        return IntlMessageFormat;
    }());

    const r={},i$1=(e,n,t)=>t?(n in r||(r[n]={}),e in r[n]||(r[n][e]=t),t):t,a=(e,n)=>{if(null==n)return;if(n in r&&e in r[n])return r[n][e];const t=E(n);for(let o=0;o<t.length;o++){const r=c(t[o],e);if(r)return i$1(e,n,r)}};let l;const s=writable({});function u(e){return e in l}function c(e,n){if(!u(e))return null;return function(e,n){if(n in e)return e[n];const t=n.split(".");let o=e;for(let e=0;e<t.length;e++)if("object"==typeof o){if(e>0){const n=t.slice(e,t.length).join(".");if(n in o){o=o[n];break}}o=o[t[e]];}else o=void 0;return o}(function(e){return l[e]||null}(e),n)}function m(e,...n){delete r[e],s.update((o=>(o[e]=cjs.all([o[e]||{},...n]),o)));}derived([s],(([e])=>Object.keys(e)));s.subscribe((e=>l=e));const d={};function g(e){return d[e]}function w(e){return E(e).some((e=>{var n;return null===(n=g(e))||void 0===n?void 0:n.size}))}function h(e,n){return Promise.all(n.map((n=>(function(e,n){d[e].delete(n),0===d[e].size&&delete d[e];}(e,n),n().then((e=>e.default||e)))))).then((n=>m(e,...n)))}const p={};function b(e){if(!w(e))return e in p?p[e]:void 0;const n=function(e){return E(e).map((e=>{const n=g(e);return [e,n?[...n]:[]]})).filter((([,e])=>e.length>0))}(e);return p[e]=Promise.all(n.map((([e,n])=>h(e,n)))).then((()=>{if(w(e))return b(e);delete p[e];})),p[e]}/*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */function v(e,n){var t={};for(var o in e)Object.prototype.hasOwnProperty.call(e,o)&&n.indexOf(o)<0&&(t[o]=e[o]);if(null!=e&&"function"==typeof Object.getOwnPropertySymbols){var r=0;for(o=Object.getOwnPropertySymbols(e);r<o.length;r++)n.indexOf(o[r])<0&&Object.prototype.propertyIsEnumerable.call(e,o[r])&&(t[o[r]]=e[o[r]]);}return t}const O={fallbackLocale:null,initialLocale:null,loadingDelay:200,formats:{number:{scientific:{notation:"scientific"},engineering:{notation:"engineering"},compactLong:{notation:"compact",compactDisplay:"long"},compactShort:{notation:"compact",compactDisplay:"short"}},date:{short:{month:"numeric",day:"numeric",year:"2-digit"},medium:{month:"short",day:"numeric",year:"numeric"},long:{month:"long",day:"numeric",year:"numeric"},full:{weekday:"long",month:"long",day:"numeric",year:"numeric"}},time:{short:{hour:"numeric",minute:"numeric"},medium:{hour:"numeric",minute:"numeric",second:"numeric"},long:{hour:"numeric",minute:"numeric",second:"numeric",timeZoneName:"short"},full:{hour:"numeric",minute:"numeric",second:"numeric",timeZoneName:"short"}}},warnOnMissingMessages:!0,ignoreTag:!0};function j(){return O}const k=writable(!1);let L;const T=writable(null);function x(e){return e.split("-").map(((e,n,t)=>t.slice(0,n+1).join("-"))).reverse()}function E(e,n=j().fallbackLocale){const t=x(e);return n?[...new Set([...t,...x(n)])]:t}function D(){return L}T.subscribe((e=>{L=e,"undefined"!=typeof window&&null!==e&&document.documentElement.setAttribute("lang",e);}));const M=T.set;T.set=e=>{if(function(e){if(null==e)return;const n=E(e);for(let e=0;e<n.length;e++){const t=n[e];if(u(t))return t}}(e)&&w(e)){const{loadingDelay:n}=j();let t;return "undefined"!=typeof window&&null!=D()&&n?t=window.setTimeout((()=>k.set(!0)),n):k.set(!0),b(e).then((()=>{M(e);})).finally((()=>{clearTimeout(t),k.set(!1);}))}return M(e)},T.update=e=>M(e(L));const Z=e=>{const n=Object.create(null);return t=>{const o=JSON.stringify(t);return o in n?n[o]:n[o]=e(t)}},C=(e,n)=>{const{formats:t}=j();if(e in t&&n in t[e])return t[e][n];throw new Error(`[svelte-i18n] Unknown "${n}" ${e} format.`)},G=Z((e=>{var{locale:n,format:t}=e,o=v(e,["locale","format"]);if(null==n)throw new Error('[svelte-i18n] A "locale" must be set to format numbers');return t&&(o=C("number",t)),new Intl.NumberFormat(n,o)})),J=Z((e=>{var{locale:n,format:t}=e,o=v(e,["locale","format"]);if(null==n)throw new Error('[svelte-i18n] A "locale" must be set to format dates');return t?o=C("date",t):0===Object.keys(o).length&&(o=C("date","short")),new Intl.DateTimeFormat(n,o)})),U=Z((e=>{var{locale:n,format:t}=e,o=v(e,["locale","format"]);if(null==n)throw new Error('[svelte-i18n] A "locale" must be set to format time values');return t?o=C("time",t):0===Object.keys(o).length&&(o=C("time","short")),new Intl.DateTimeFormat(n,o)})),_=(e={})=>{var{locale:n=D()}=e,t=v(e,["locale"]);return G(Object.assign({locale:n},t))},q=(e={})=>{var{locale:n=D()}=e,t=v(e,["locale"]);return J(Object.assign({locale:n},t))},B=(e={})=>{var{locale:n=D()}=e,t=v(e,["locale"]);return U(Object.assign({locale:n},t))},H=Z(((e,n=D())=>new IntlMessageFormat(e,n,j().formats,{ignoreTag:j().ignoreTag}))),K=(e,n={})=>{"object"==typeof e&&(e=(n=e).id);const{values:t,locale:o=D(),default:r}=n;if(null==o)throw new Error("[svelte-i18n] Cannot format a message without first setting the initial locale.");let i=a(e,o);if(i){if("string"!=typeof i)return console.warn(`[svelte-i18n] Message with id "${e}" must be of type "string", found: "${typeof i}". Gettin its value through the "$format" method is deprecated; use the "json" method instead.`),i}else console.warn(`[svelte-i18n] The message "${e}" was not found in "${E(o).join('", "')}".${w(D())?"\n\nNote: there are at least one loader still registered to this locale that wasn't executed.":""}`),i=r||e;if(!t)return i;let l=i;try{l=H(i,o).format(t);}catch(n){console.warn(`[svelte-i18n] Message "${e}" has syntax error:`,n.message);}return l},Q=(e,n)=>B(n).format(e),R=(e,n)=>q(n).format(e),V=(e,n)=>_(n).format(e),W=(e,n=D())=>a(e,n);derived([T,s],(()=>K));derived([T],(()=>Q));derived([T],(()=>R));derived([T],(()=>V));derived([T,s],(()=>W));

    var UserStatus;
    (function (UserStatus) {
        UserStatus[UserStatus["Offline"] = 0] = "Offline";
        UserStatus[UserStatus["Online"] = 1] = "Online";
        UserStatus[UserStatus["None"] = 2] = "None";
    })(UserStatus || (UserStatus = {}));
    var AvatarSize;
    (function (AvatarSize) {
        AvatarSize[AvatarSize["Tiny"] = 0] = "Tiny";
        AvatarSize[AvatarSize["Small"] = 1] = "Small";
        AvatarSize[AvatarSize["Medium"] = 2] = "Medium";
        AvatarSize[AvatarSize["Large"] = 3] = "Large";
        AvatarSize[AvatarSize["ExtraLarge"] = 4] = "ExtraLarge";
    })(AvatarSize || (AvatarSize = {}));

    /**
     * Convert array of 16 byte values to UUID string format of the form:
     * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
     */
    var byteToHex = [];
    for (var i = 0; i < 256; ++i) {
      byteToHex[i] = (i + 0x100).toString(16).substr(1);
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    function createSetStore(store) {
        return {
            subscribe: store.subscribe,
            set: store.set,
            add: (id) => {
                if (!get_store_value(store).has(id)) {
                    store.update((ids) => {
                        ids.add(id);
                        return new Set(ids);
                    });
                    return true;
                }
                return false;
            },
            delete: (id) => {
                if (get_store_value(store).has(id)) {
                    store.update((ids) => {
                        ids.delete(id);
                        return new Set(ids);
                    });
                    return true;
                }
                return false;
            },
            clear: () => store.update((ids) => {
                ids.clear();
                return ids;
            }),
        };
    }

    const store = writable({});
    createSetStore(writable(new Set()));
    ({
        subscribe: store.subscribe,
        getMessages: (chatId) => {
            var _a, _b;
            return (_b = (_a = get_store_value(store)[chatId]) === null || _a === void 0 ? void 0 : _a.messages) !== null && _b !== void 0 ? _b : [];
        },
        add: (chatId, message) => {
            store.update((state) => {
                let chatEvents = state[chatId];
                if (chatEvents === undefined) {
                    chatEvents = {
                        messages: [],
                        messageIds: new Set(),
                    };
                    state[chatId] = chatEvents;
                }
                chatEvents.messages.push(message);
                chatEvents.messageIds.add(message.event.messageId);
                return Object.assign(Object.assign({}, state), { [chatId]: chatEvents });
            });
        },
        contains: (chatId, messageId) => {
            var _a, _b;
            return (_b = (_a = get_store_value(store)[chatId]) === null || _a === void 0 ? void 0 : _a.messageIds.has(messageId)) !== null && _b !== void 0 ? _b : false;
        },
        delete: (chatId, messageId) => {
            var _a;
            if ((_a = get_store_value(store)[chatId]) === null || _a === void 0 ? void 0 : _a.messageIds.has(messageId)) {
                store.update((state) => {
                    const chatEvents = state[chatId];
                    if (chatEvents === null || chatEvents === void 0 ? void 0 : chatEvents.messageIds.delete(messageId)) {
                        return Object.assign(Object.assign({}, state), { [chatId]: {
                                messages: chatEvents.messages.filter((e) => e.event.messageId !== messageId),
                                messageIds: chatEvents.messageIds,
                            } });
                    }
                    return state;
                });
                return true;
            }
            return false;
        },
        clear: () => store.set({}),
    });

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

    Rollbar.init({
        accessToken: "process.env.ROLLBAR_ACCESS_TOKEN",
        captureUncaught: true,
        autoInstrument: false,
        logLevel: "error",
        environment: "development",
        enabled: "development" === "production",
        captureUnhandledRejections: true,
    });

    async function getSoftDisabled() {
        return false;
    }

    function toUint8Array(base64String) {
        return Uint8Array.from(atob(base64String), (c) => c.charCodeAt(0));
    }

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
        if (!event.data)
            return;
        const bytes = toUint8Array(event.data.text());
        // Try to extract the typed notification from the event
        const candid = decode([Notification], bytes)[0];
        if (!candid) {
            return;
        }
        const notification$1 = notification(candid);
        const windowClients = await self.clients.matchAll({
            type: "window",
            includeUncontrolled: true,
        });
        windowClients.forEach((window) => {
            window.postMessage({
                type: "NOTIFICATION_RECEIVED",
                data: notification$1,
            });
        });
        // If notifications are disabled or an OC browser window already has the focus then don't show a notification
        if ((await getSoftDisabled()) || (await isClientFocused())) {
            return;
        }
        await showNotification(notification$1);
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
                path: event.notification.data.path,
            });
        }
        else {
            const urlToOpen = new URL(self.location.origin).href + "#/" + event.notification.data.path;
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
        let path;
        if (notification.kind === "direct_notification") {
            const content = extractMessageContent(notification.message.event.content);
            title += notification.senderName;
            body = content.text;
            icon = (_a = content.image) !== null && _a !== void 0 ? _a : icon;
            path = notification.sender;
        }
        else if (notification.kind === "group_notification") {
            const content = extractMessageContent(notification.message.event.content, notification.mentioned);
            title += notification.groupName;
            body = `${notification.senderName}: ${content.text}`;
            icon = (_b = content.image) !== null && _b !== void 0 ? _b : icon;
            path = notification.chatId;
        }
        else if (notification.kind === "added_to_group_notification") {
            // TODO Multi language support
            title += notification.groupName;
            body = `${notification.addedByUsername} added you to the group "${notification.groupName}"`;
            path = notification.chatId;
        }
        else {
            throw new UnsupportedValueError("Unexpected notification type received", notification);
        }
        await self.registration.showNotification(title, {
            body,
            icon,
            tag: path,
            data: {
                path,
            },
        });
    }
    function extractMessageContent(content, mentioned = []) {
        var _a, _b, _c, _d;
        let result;
        if (content.kind === "text_content") {
            result = {
                text: content.text,
            };
        }
        else if (content.kind === "image_content") {
            result = {
                text: (_a = content.caption) !== null && _a !== void 0 ? _a : extractMediaType(content.mimeType),
                image: content.thumbnailData,
            };
        }
        else if (content.kind === "video_content") {
            result = {
                text: (_b = content.caption) !== null && _b !== void 0 ? _b : extractMediaType(content.mimeType),
                image: content.thumbnailData,
            };
        }
        else if (content.kind === "audio_content") {
            result = {
                text: (_c = content.caption) !== null && _c !== void 0 ? _c : extractMediaType(content.mimeType),
            };
        }
        else if (content.kind === "file_content") {
            result = {
                text: (_d = content.caption) !== null && _d !== void 0 ? _d : content.mimeType,
                image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAABmJLR0QA/wD/AP+gvaeTAAAA30lEQVRoge2ZMQ6CQBBFn8baA2jNPS09ig29dyIWcAEtxMRY6Cw7O6Pmv2QLEpj/X4YKQAhhoQN6YAKulecQ3J0OuDgUT5PoncuHS3i8NqkSr6Fecx7nWFuwNNhrTphEhEBTiSiBZhKRAk0kogXcJTIEXCWyBEwSK2Nw6TOWOVbe5q0XDv0aNoFZ1s0VbernNyCBbCSQjQSykUA2EshGAtlIIBsJZCOBbCSQjeWrxARsn65rPm6VMn66wbKBs0ORpbhk74GB+t9JpWcAdh4CzINO3Ffauvg4Z7mVF+KfuQEADATf0SgDdQAAAABJRU5ErkJggg==",
            };
        }
        else if (content.kind === "crypto_content") {
            result = {
                text: "TODO - crypto content",
            };
        }
        else if (content.kind === "deleted_content") {
            result = {
                text: "TODO - deleted content",
            };
        }
        else if (content.kind === "placeholder_content") {
            result = {
                text: "TODO - placeholder content",
            };
        }
        else {
            throw new UnsupportedValueError("Unexpected message content type received with notification", content);
        }
        if (mentioned.length > 0) {
            result.text = replaceMentions(result.text, mentioned);
        }
        return result;
    }
    function extractMediaType(mimeType) {
        return mimeType.replace(/\/.*/, "");
    }
    function replaceMentions(text, mentioned) {
        const usernameLookup = Object.fromEntries(mentioned.map((u) => [u.userId, u.username]));
        return text.replace(/@UserId\(([\d\w-]+)\)/g, (_match, p1) => {
            var _a;
            const username = (_a = usernameLookup[p1]) !== null && _a !== void 0 ? _a : "Unknown";
            return `@${username}`;
        });
    }

}());
//# sourceMappingURL=sw.js.map
