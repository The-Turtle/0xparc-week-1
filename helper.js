function parseRSAPublicKey(keyString) {
    const parts = keyString.trim().split(/\s+/);
    if (parts.length < 2 || parts[0] !== "ssh-rsa") {
        alert("Invalid key format");
        return null;
    }
    const keyData = atob(parts[1]);
    // Helper to read big-endian 4-byte int
    function readUint32(bytes, offset) {
        return (
            (bytes[offset] << 24) |
            (bytes[offset + 1] << 16) |
            (bytes[offset + 2] << 8) |
            (bytes[offset + 3])
        ) >>> 0;
    }
    // Convert string to byte array
    const bytes = [];
    for (let i = 0; i < keyData.length; i++) {
        bytes.push(keyData.charCodeAt(i));
    }
    let offset = 0;
    // Read "ssh-rsa"
    const typeLen = readUint32(bytes, offset);
    offset += 4;
    const type = String.fromCharCode(...bytes.slice(offset, offset + typeLen));
    offset += typeLen;
    if (type !== "ssh-rsa") {
        alert("Not an ssh-rsa key");
        return null;
    }
    // Read exponent
    const eLen = readUint32(bytes, offset);
    offset += 4 + eLen;
    // Read modulus
    const nLen = readUint32(bytes, offset);
    offset += 4;
    const nBytes = bytes.slice(offset, offset + nLen);
    // Convert modulus bytes to hex string
    let hex = "";
    for (let b of nBytes) {
        hex += b.toString(16).padStart(2, "0");
    }
    // Convert hex to BigInt
    const modulus = BigInt("0x" + hex);
    return modulus;
}

function splitBigIntToChunks(bigint, chunkBits = 120, numChunks = 35) {
    const chunks = [];
    const mask = (1n << BigInt(chunkBits)) - 1n;
    for (var i = 0; i < numChunks; i++) {
        chunks.push(String((bigint & mask << BigInt(i * chunkBits)) >> BigInt(i * chunkBits)));
    }
    return chunks;
}

function sha256(message) {
    if (window.crypto && window.crypto.subtle) {
        const encoder = new TextEncoder();
        return window.crypto.subtle.digest("SHA-256", encoder.encode(message))
            .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join(""));
    } else {
        throw new Error("Web Crypto API not available");
    }
}

function sha512(message) {
    if (window.crypto && window.crypto.subtle) {
        const encoder = new TextEncoder();
        return window.crypto.subtle.digest("SHA-512", encoder.encode(message))
            .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join(""));
    } else {
        throw new Error("Web Crypto API not available");
    }
}

function parseSSHSignature(b64) {
    // Decode Base64 to a Uint8Array
    const binStr = atob(b64);
    const buf = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) {
      buf[i] = binStr.charCodeAt(i);
    }
    const dv = new DataView(buf.buffer);
  
    let offset = 0;
    // 1) Check the ASCII magic "SSHSIG"
    const magic = String.fromCharCode(...buf.slice(0, 6));
    if (magic !== "SSHSIG") {
      throw new Error("Invalid SSHSIG magic; expected 'SSHSIG'");
    }
    offset += 6;
  
    // 2) Read version (uint32)
    const version = dv.getUint32(offset, false);
    offset += 4;
    if (version !== 1) {
      throw new Error("Unsupported SSHSIG version " + version);
    }
  
    // 3) Read an SSH string: publickey
    const readString = () => {
      const len = dv.getUint32(offset, false);
      offset += 4;
      const bytes = buf.slice(offset, offset + len);
      offset += len;
      return bytes;
    };
    const publickeyBlob = readString();
  
    // 4) Skip namespace, reserved, and hash_algorithm
    readString(); // namespace
    readString(); // reserved
    readString(); // hash_algorithm
  
    // 5) Read the signature field (itself an SSH string)
    const sigBlob = readString();
  
    // --- Now parse publickeyBlob as an SSH-encoded "ssh-rsa" key:
    //    string    "ssh-rsa"
    //    mpint     e
    //    mpint     n
    const pkDv = new DataView(publickeyBlob.buffer);
    let pkOff = 0;
    // skip the algorithm name
    const nameLen = pkDv.getUint32(pkOff, false);
    pkOff += 4 + nameLen;
    // skip the exponent e mpint
    const eLen = pkDv.getUint32(pkOff, false);
    pkOff += 4 + eLen;
    // read the modulus n mpint
    const nLen = pkDv.getUint32(pkOff, false);
    pkOff += 4;
    const nBytes = publickeyBlob.slice(pkOff, pkOff + nLen);
    
    const publicKey = bytesToBigInt(nBytes);
  
    // --- Now parse the sigBlob as:
    //    string   sig-algo (e.g. "rsa-sha2-512")
    //    string   mpint signature
    const sDv = new DataView(sigBlob.buffer);
    let sOff = 0;
    const algoLen = sDv.getUint32(sOff, false);
    sOff += 4 + algoLen;
    const sigLen = sDv.getUint32(sOff, false);
    sOff += 4;
    const sigBytes = sigBlob.slice(sOff, sOff + sigLen);
    const signature = bytesToBigInt(sigBytes);
  
    return { signature, publicKey };
  
    // Helper: big-endian bytes → BigInt
    function bytesToBigInt(bytes) {
      let hex = [];
      for (let b of bytes) {
        hex.push(b.toString(16).padStart(2, "0"));
      }
      return BigInt("0x" + hex.join(""));
    }
}