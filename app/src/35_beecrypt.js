/* ---------------- 🔐 sealing and codes (shared by BEE and the student computer version) ----------------
   Everything here uses the browser's own cryptography (Web Crypto), which works offline.
   • start code  → PBKDF2 → AES-GCM key: locks the question paper inside the student file
   • teacher key → RSA-OAEP: the student file can SEAL answers for the teacher, but never open them
   • teacher code → PBKDF2 hash: checked to unlock a locked test */
const BC = (() => {
  const enc = new TextEncoder(), dec = new TextDecoder();
  const ALPHA = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";   // no 0/O, 1/I/L: easy to read aloud and type
  const b64e = u8 => { u8 = u8 instanceof Uint8Array ? u8 : new Uint8Array(u8); let s = ""; for(let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const b64d = s => { const b = atob(s), u8 = new Uint8Array(b.length); for(let i = 0; i < b.length; i++) u8[i] = b.charCodeAt(i); return u8; };
  const rnd = n => crypto.getRandomValues(new Uint8Array(n));
  async function gz(u8){
    if(typeof CompressionStream === "undefined") return { z: 0, u8 };
    const s = new Blob([u8]).stream().pipeThrough(new CompressionStream("gzip"));
    return { z: 1, u8: new Uint8Array(await new Response(s).arrayBuffer()) };
  }
  async function gunz(u8, z){
    if(!z) return u8;
    const s = new Blob([u8]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  const norm = c => String(c || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  function newCode(n, digits){
    const A = digits ? "0123456789" : ALPHA, r = rnd(n);
    let s = ""; for(let i = 0; i < n; i++) s += A[r[i] % A.length];
    return digits ? s : s.slice(0, n / 2) + "-" + s.slice(n / 2);
  }
  async function codeKey(code, salt, iter){
    const base = await crypto.subtle.importKey("raw", enc.encode(norm(code)), "PBKDF2", false, ["deriveKey", "deriveBits"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt: b64d(salt), iterations: iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function codeHash(code, salt, iter){
    const base = await crypto.subtle.importKey("raw", enc.encode(norm(code)), "PBKDF2", false, ["deriveBits"]);
    return b64e(await crypto.subtle.deriveBits({ name: "PBKDF2", salt: b64d(salt), iterations: iter, hash: "SHA-256" }, base, 256));
  }
  // lock / unlock any JSON-able value with an AES key
  async function lock(key, obj){
    const { z, u8 } = await gz(enc.encode(JSON.stringify(obj))), iv = rnd(12);
    return { z, iv: b64e(iv), ct: b64e(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, u8)) };
  }
  async function unlock(key, box){
    const u8 = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64d(box.iv) }, key, b64d(box.ct)));
    return JSON.parse(dec.decode(await gunz(u8, box.z)));
  }
  // seal for the teacher: anyone with the public key can seal; only the private key opens
  const RSA = { name: "RSA-OAEP", hash: "SHA-256" };
  async function seal(obj, pubJwk){
    const pub = await crypto.subtle.importKey("jwk", pubJwk, RSA, false, ["encrypt"]);
    const k = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const box = await lock(k, obj);
    box.ek = b64e(await crypto.subtle.encrypt(RSA, pub, await crypto.subtle.exportKey("raw", k)));
    return box;
  }
  async function unseal(box, privJwk){
    const priv = await crypto.subtle.importKey("jwk", privJwk, RSA, false, ["decrypt"]);
    const raw = await crypto.subtle.decrypt(RSA, priv, b64d(box.ek));
    return unlock(await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]), box);
  }
  async function newTeacherKey(){
    const kp = await crypto.subtle.generateKey(Object.assign({ modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) }, RSA), true, ["encrypt", "decrypt"]);
    const pub = await crypto.subtle.exportKey("jwk", kp.publicKey), priv = await crypto.subtle.exportKey("jwk", kp.privateKey);
    return { pub, priv, kid: await kidOf(pub), created: Date.now() };
  }
  async function kidOf(pub){
    const h = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(pub.n)));
    return b64e(h.slice(0, 9)).replace(/[+/=]/g, "x");
  }
  return { b64e, b64d, rnd, norm, newCode, codeKey, codeHash, lock, unlock, seal, unseal, newTeacherKey, kidOf };
})();
