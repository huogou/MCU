const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const src = 'D:/SEO/发挥余热/漫威电影宇宙导航/小红书小工具/dist';
const out = 'D:/SEO/发挥余热/漫威电影宇宙导航/小红书小工具/mcu-atlas-minitool.zip';

try { fs.unlinkSync(out); } catch (e) {}

const files = [];
function walk(dir, rel) {
  fs.readdirSync(dir).forEach(function (f) {
    var p = path.join(dir, f);
    var r = rel ? path.posix.join(rel, f) : f;
    var s = fs.statSync(p);
    if (s.isDirectory()) walk(p, r);
    else files.push({ abs: p, rel: r, size: s.size });
  });
}
walk(src, '');

if (files.length === 0) {
  console.log('NO_FILES');
  process.exit(1);
}

var parts = [];
var central = [];
var offset = 0;

function writeUInt16(buf, val, off) { buf.writeUInt16LE(val & 0xffff, off); }
function writeUInt32(buf, val, off) { buf.writeUInt32LE(val >>> 0, off); }

files.forEach(function (f) {
  var raw = fs.readFileSync(f.abs);
  var comp = zlib.deflateRawSync(raw, { level: 6 });
  // 若压缩后更大则存原数据
  var buf = comp.length < raw.length ? comp : raw;
  var method = comp.length < raw.length ? 8 : 0;
  var name = Buffer.from(f.rel, 'utf8');
  var local = Buffer.allocUnsafe(30);
  writeUInt32(local, 0x04034b50, 0);
  writeUInt16(local, 20, 4);
  writeUInt16(local, 0x800, 6); // general purpose bit flag: UTF-8 filename
  writeUInt16(local, method, 8); // compression method (0=store, 8=deflate)
  writeUInt16(local, 0, 10);
  var crc = zlib.crc32(raw);
  writeUInt32(local, crc, 14);
  writeUInt32(local, buf.length, 18);
  writeUInt32(local, raw.length, 22);
  writeUInt16(local, name.length, 26);
  writeUInt16(local, 0, 28);
  parts.push(local, name, buf);

  var c = Buffer.allocUnsafe(46);
  writeUInt32(c, 0x02014b50, 0);
  writeUInt16(c, 20, 4);
  writeUInt16(c, 20, 6);
  writeUInt16(c, 0x800, 8);
  writeUInt16(c, method, 10);
  writeUInt32(c, crc, 16);
  writeUInt32(c, buf.length, 20);
  writeUInt32(c, raw.length, 24);
  writeUInt16(c, name.length, 28);
  writeUInt16(c, 0, 30);
  writeUInt16(c, 0, 32);
  writeUInt16(c, 0, 34);
  writeUInt16(c, 0, 36);
  writeUInt32(c, 0, 38);
  writeUInt32(c, offset, 42);
  central.push(c, name);
  offset += local.length + name.length + buf.length;
});

var centralOffset = offset;
central.forEach(function (b) { parts.push(b); });
var centralSize = central.reduce(function (a, b) { return a + b.length; }, 0);

var end = Buffer.allocUnsafe(22);
writeUInt32(end, 0x06054b50, 0);
writeUInt16(end, 0, 4);
writeUInt16(end, 0, 6);
writeUInt16(end, files.length, 8);
writeUInt16(end, files.length, 10);
writeUInt32(end, centralSize, 12);
writeUInt32(end, centralOffset, 16);
writeUInt16(end, 0, 20);
parts.push(end);

fs.writeFileSync(out, Buffer.concat(parts));
console.log('ZIP_OK', out, files.length + ' files');
console.log(JSON.stringify(files.map(function (f) { return f.rel + ' (' + f.size + ')'; }), null, 2));
