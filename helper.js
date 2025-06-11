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

function parseSignature(signature) {
    const raw = atob(signature);
    let hex = "";
    for (let i = 0; i < raw.length; i++) {
        hex += raw.charCodeAt(i).toString(16).padStart(2, "0");
    }
    return BigInt("0x" + hex);
}

function splitBigIntToChunks(bigint, chunkBits = 120, numChunks = 35) {
    const mask = (1n << BigInt(chunkBits)) - 1n;
    const chunks = [];
    let value = bigint;
    for (let i = 0; i < numChunks; i++) {
        chunks.push(value & mask);
        value >>= BigInt(chunkBits);
    }
    return chunks.map(chunk => chunk.toString());
}

const holdenPublicKey = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDSeqUGIrvHAAFF3uZ1eOm5yGItZQEYkcLCJo4VSpqBvdIep1LWrcIPYASiFNT7bDX1rJ50qKsx6o6y9XJP6e5nIF2j+KJ8Qwf0h2yqqUm6uoB5MwKqpEMmk4fYJ+MmUc7yzTaaDVboM+KtO9wk7JcH5WXuvpTc/GPqCdaJFwYe9DZXsueoTcCPKDiU2MgivJGulBVcNGqagg1Zs+Pv4uU6XA49geMvpLHd5S2zZraG0XlE/aCj9hGoANvvJcyaGKuwmOplmzJ9s0J+8j86/3v5frI4WPTYnX6SInVaCSjhJGg4OvIT8NVBvFdu35KFvQqQFqsXWM3hZ0UGVx6XBSUaFCh4TRqOgVngv6WZ2tdRhq7gn3XHJ+kuIP9Rd4Sl3+pY4vb0sTHbeRciNRlvccobn1ao8eZyReYdfe+L7/T3rxmlqIVXLJGIRno6XWS4cOvdOFHxF7ouf7Ll24GSY0/yZqvXDojSCg1Cpjg35SEGJ06KqO1sy2p88WVjt3Stc2zhlYEQVSNXvBzRHTV4Xi4iT68UT3txHm0snRhNIxkEAnA3bBNEcAOvn/c5RiC44OGl/N3rrLQAaoohL1Pt5nRv2slA8XDAfWtP7QKcgSIsmXGbztKkcmWb3mVy+YSvaLLi7lvi6r1HtADFBbiojmRKYZxGHuz8qJEFiCxQHnop2Q==";
const pranjalPublicKey = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQCpcGyI8jC+r1EcksaZwVM4vKFzrfMoZ+fDEW6dhQ7OVSwq+T0erXssZ+w2IvTYKIy3aOiebAxPl+NdLLrpXWdq8g/yt0MhF7fbaAj7PLJukpSiWrgvu6/tkd3hTkhN8YC2FbjKSgq6fYKm95nt0BplnVn129ZXEaCKxRcxrQifumf1donbIfyRKScvulDu6ojusNvuPhUPPKTE1A6x5A4uXIU4aEn+vkpZbCbVzsNX7N9YHOmphtxuJAKoqIDZ7NxaeYXQgUoPvZagu/RkYQgL8+B8kqH/B4Hj6pIaXSxiwBUoxovnDp/0Si8FsXfKwj2BWnN2HbzqV78cMrI/HDxIkoFa20zLkA3ATIvEX7UMTd9Q+JritrDWCngxfb+QC91nj/g9MfufcFUDZkyhHyYmikdbqMSxAXgSkmil6QHr5PiehmuwvY53QWjokNIBHn3XkCmYdlqD7LgvHV4Bj69XYRD+rWvYH7uzNFmgdMSEtwYWOT9Pk53U9yCmrRzfAYen/Fp1MBHYH2eRe+ICE6LI+xUI/LqOj1tLJcC+c0lxmDcUs5loDLM6fpOotymHmoZERdPAOcxjy4siNN027EatSLBXlQ7Z2kzJQXaEHYQ6GZ6TE2HLZeH9COnNmX9rKR/E7Ohasx1Co9Lm2ZDhPJV5mtD3FSo7DRghuHmcPmgTjQ==";
const duruPublicKey = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDHq6HsKjUDHNza6Ql1/1swbw1Af29u3L9/pSLtxB/glMjX3D+nFf66R/R2AIVRKZ5+dLyKwxWbNUX9JNbXv4pwjUCjI6kh0khTROl1MtvQV0jRXWv2KFMg4bXyb/+vZvVxGQZwgjty8d6VZxtY9S2ip9NK4X7XHmXDMeXbweHrllJM3VkC6ZNdasLXRr/iNf3JoMuRExYC5CY9kQ2RLVbav3ARF/kdhlfQsB8Gd5SfxNkD2GNDdpJ8EApgNABput6nOC84lztXqyKWjFVALD8dplq0R5UG4wQxbiWIKDkbRd2GmWyXVK1t/U39AVhWbLrZkZ/VV/tZmXLWxDJriAFNc168pgV3gnY8iyYm3nfi58xj1XuoZbQLrVjFYo/XQWjBkIvv6eVZAYTp5qDwLFAH4YB7pPXE4jCybZ0fibhOXSpSovQbHGjkEO/SIevYBJsrKnZqfpzmW7N5Dcc/u5YnSbdBGJoZAkwcMMZpka2NcWoBzkUFs/+TFPzhQ4dHfpmHKrDjWJPXgMQmYTxDoPDZ/y7L4HFDtOTaE0vER8EODiJpN+pQnTeapf3ctRlNbrt84fZeX0LMPy6fKvLF2FNnlVhEqxXnbg1jxumN+Haeb6y6Flv6ERyzPi1zyc2HY3sw9NdAxJG85O/LaiJQZiaNNUxI0EFv856FVKC0NlT3dQ==";
const samplePublicKey = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDdwYjQNGRaeF2bDdzPhPQuOGv0+pkpGYjHwfsvJ+2wVboRgGtKXmm6D7dmTN7WqX2fMRRcHv5wlrccb4JKMDLi6BCOIkDgzU/7siYb1ErmFPLx/3lbQ3Y6eGQWLcAphxMSM0XKXSYMhOx0cRINeeVOPmsCeWXXPLsA+h2sfflnsv6zJwWEBwhNksNwWQ0svvXEf9qMrvzCjVlNchsK2QurMTrnswLKrX7uxhfJ+Y3PoCIIXjbRCvL7KGyf1j0Dt79E5gusGE+2OIRv5VrRirOHKc9Iy9XrcpdslT4IWMy7JKgBZOtr9mS0KCLaOKCcTNHof0w1ClQj9DL7FmMtTlR2isYTytp1yhmRZbSooSGzAJViDMAwN1UNj/yh7HXrx+PUsNbJh91FYh80+TiYbpnzjrhuuOSTT9hSKuNSlSTySyO4VMrSsvOVQaM5mOnnoOn0NupsUvBl3cKLlkTZLHrvrzwipX/QOEqejDlUjBkeIa3JTzY7Mx9chV2U3R/QMsRP13AklhHpYT7VhIv0czyXx2D7xWjQ3BpUQ3ogaaFpCc8ehf5YxyiuwIGQAaxt0I6dReLwhlkCWWHNt5eMAV6PfIEXtrVHV9WySNDe9/V4BkAVORcTTdZ+H5RyQuuCMmHyfSrlhmml2jKwLYFfTeMOfgWau8MTs1R501ZKM4wLDQ==";

const sampleMessage = "some data";

const sampleSignature = "mMMH4crddVPNAlcVs+XBGThAuIuqMFGpOjImneWaDADRWBACN1V/TxnQUWeAYaub7icutB/C2eb0E9AxTMO4g6FD3s/+QYX3jzk9Zc59ZD8MZ5vy02lkV2Yap1cQKuj6kESgi9Nzf919kDuMCLKkm3x2Re4dCo74WZbymuuAcJQ=";

const samplePublicKeys = holdenPublicKey + ", " + pranjalPublicKey + ", " + duruPublicKey + ", " + samplePublicKey;