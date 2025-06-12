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

function sha512(message) {
    if (window.crypto && window.crypto.subtle) {
        const encoder = new TextEncoder();
        return window.crypto.subtle.digest("SHA-512", encoder.encode(message))
            .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join(""));
    } else {
        throw new Error("Web Crypto API not available");
    }
}

function pkcs1v15PadSHA512(hashHex, modulus) {
    // Calculate the number of bits in the modulus
    const modulusBits = modulus.toString(2).length;
    
    // The SHA-512 OID + ASN.1 structure for the hash algorithm
    const hashPrefix = "3051300d060960864801650304020305000440";
    
    // Combine the hash prefix with the actual hash value
    const encodedHash = hashPrefix + hashHex;
    
    // Calculate padding length (in bytes)
    const modulusBytes = Math.ceil(modulusBits / 8);
    const paddingLength = modulusBytes - 3 - encodedHash.length / 2;
    
    if (paddingLength < 8) {
        throw new Error("Modulus too small for the hash and padding");
    }
    
    // Create the padding string (0xFF bytes)
    const padding = "ff".repeat(paddingLength);
    
    // Construct the padded message: 0x00 || 0x01 || PS || 0x00 || T
    const paddedMessage = "0001" + padding + "00" + encodedHash;
    
    // Convert the hex string to a BigInt
    return BigInt("0x" + paddedMessage);
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

var workingKeyNumber = BigInt("765365417809111255173813275650104224477624059776447535885513472137469549548611322888758065033348510659634589161078370833886653009538144102732162987774336840494333278013063217054881402747727681340790093483230045693919272432568332051124206130514953672735356311775646723951515131388787696718471578103894940282504646831686486861000248853535504615812396333729035685073654860260940278839814442937662279649824336306707723231147255732865678612441027906432284597477556787875621474509432640456917295793982923026496785229330268333812550109676472285743611288588510717098991542405085451819002650232069248180536463305628662169272604687125091876626796013027379677714495409081061224738229117259438464442685011601432965137063676372732798874301207025557225556965422968175098796266354147727834505479749010295731418457012387726549380222766064318215547076785360396734986647005224555704228242333571449672876716775079975715538928381741193155415601062965978769684991219076160500083679310125912149190913725773259937029115459431371350936324628499946969760781921589583856303018122386278654292784613962059267403834603838567190594311566967321640891454878781349774536679097237118689231013038393578043788805942154168256625146811173762630672445727472324199980463733");
var workingSignatureNumber = BigInt("513972500123500405797385317895860157493841898351405151073928059416528548370176498959331644500248212280796631703513345258306391989391426999019803214203485660362327062078020758330784617312863938318014314944087042758408884547900325776665340631753563982854721016719113381328381772432029744130998359473801784636610111780004642056996217099703402068625365269386539561088103095411361891761737172491540898754546629092368503818753828661846296323332815849946595797739340037423358470765792679981456555697548552071728038810176408676631962204873525353130734219137768505842094782790890904298598081033893439699426383521984810154993316720422997300883918865556765896948044536801584765106822202631107394033392839460578616931962515019707496546179923254295471384342520971075492036573731306284348425716851042621366306680728305204826529772778472242729652133395362220605480948474451641903666412775552618907901702743338695768597690078188435701760987814499251952278832434546155817862421126897986125631326248418707160157482212542675681175986866888165009421417973019545006695170084577843419800330043589437766302667209971528724304897436991560517765258860533551228997269109226122150495351758559921216856446960522423277152302846861140484992137409000278053299259616");
var workingMessageNumber = BigInt("31872219281407242025505148642475109331663948030010491344733687844358944945421064967310388547820970408352359213697487269225694990179009814674781374751323403257628081559561462351695605167675284372388551941279783515209238245831229026662363729380633136520288327292047232179909791526492877475417113579821717193807584807644097527647305469671333646868883650312280989663788656507661713409911267085806708237966730821529702498972114194166091819277582149433578383639532136271637219758962252614390071122773223025154710411681628917523557526099053858210363406122853294409830276270946292893988830514538950951686480580886602618927728470029090747400687617046511462665469446846624685614084264191213318074804549715573780408305977947238915527798680393538207482620648181504876534152430149355791756374642327623133843473947861771150672096834149014464956451480803326284417202116346454345929350148770746553056995922154382822307758515805142704373984019252210715650875853634697920708113806880196144197384637328982263167395073688501517286678083973976140676496503902620739121794758631023740953944512425741321266089553042243521593428572532834314005559057559722764629865662229640289202512152380151356448373718257579496692938925516737296539235422467714402150447");