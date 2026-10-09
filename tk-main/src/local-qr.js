import QRCode from './qr-code/index.js';
import QRErrorCorrectLevel from './qr-code/QRErrorCorrectLevel.js';

const PNG_SIGNATURE = Uint8Array.from([137,80,78,71,13,10,26,10]);
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n=0;n<256;n++) { let c=n; for (let k=0;k<8;k++) c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1); t[n]=c>>>0; }
  return t;
})();
function crc32(bytes) { let c=0xffffffff; for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8); return (c^0xffffffff)>>>0; }
function u32(n) { return Uint8Array.from([(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]); }
function concat(parts) { const n=parts.reduce((s,p)=>s+p.length,0), out=new Uint8Array(n); let at=0; for(const p of parts){out.set(p,at);at+=p.length;} return out; }
function chunk(type,data) {
  const name=new TextEncoder().encode(type), body=concat([name,data]);
  return concat([u32(data.length),body,u32(crc32(body))]);
}
async function deflate(bytes) {
  if (typeof CompressionStream!=='function') throw new Error('PNG compression is unavailable');
  const stream=new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
function matrixFor(text) {
  const qr=new QRCode(-1,QRErrorCorrectLevel.H);
  qr.addData(text);
  qr.make();
  if(!Array.isArray(qr.modules)||!qr.modules.length) throw new Error('QR matrix generation failed');
  return qr.modules;
}
export async function generateQrPng(text, requestedSize=180) {
  const matrix=matrixFor(String(text));
  const quiet=4, moduleCount=matrix.length, totalModules=moduleCount+quiet*2;
  const cap=Math.max(120,Math.min(600,Number(requestedSize)||180));
  // Keep every module a crisp integer number of pixels. The resulting PNG may be
  // smaller than the requested cap, but never scales module edges fractionally.
  const scale=Math.max(1,Math.floor(cap/totalModules));
  const width=totalModules*scale, height=width, stride=1+width*4;
  const raw=new Uint8Array(stride*height);
  for(let y=0;y<height;y++){
    const row=y*stride; raw[row]=0;
    const my=Math.floor(y/scale)-quiet;
    for(let x=0;x<width;x++){
      const mx=Math.floor(x/scale)-quiet;
      const dark=my>=0&&my<moduleCount&&mx>=0&&mx<moduleCount&&matrix[my][mx];
      const c=dark?0:255, i=row+1+x*4;
      raw[i]=c; raw[i+1]=c; raw[i+2]=c; raw[i+3]=255;
    }
  }
  const ihdr=concat([u32(width),u32(height),Uint8Array.from([8,6,0,0,0])]);
  const compressed=await deflate(raw);
  return concat([PNG_SIGNATURE,chunk('IHDR',ihdr),chunk('IDAT',compressed),chunk('IEND',new Uint8Array())]);
}
