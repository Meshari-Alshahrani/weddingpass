/**
 * WeddingPass - Image Magic Bytes Security Validator
 * Version: 5.9.2
 * Inspects leading binary bytes to ensure files are authentic images (WebP, JPEG, PNG, GIF, AVIF)
 * and defense against polyglot / script upload attacks.
 */

export function validateImageMagicBytes(buffer: Buffer | Uint8Array): boolean {
  if (!buffer || buffer.length < 3) return false;

  // 1. JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true;
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return true;
  }

  // 3. WebP: RIFF (and optional WEBP check)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 // F
  ) {
    if (buffer.length >= 12) {
      return (
        buffer[8] === 0x57 && // W
        buffer[9] === 0x45 && // E
        buffer[10] === 0x42 && // B
        buffer[11] === 0x50 // P
      );
    }
    return true;
  }

  // 4. GIF: GIF87a or GIF89a (47 49 46 38 37/39 61)
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return true;
  }

  // 5. AVIF / HEIC: ....ftyp (66 74 79 70) at offset 4
  if (
    buffer.length >= 8 &&
    buffer[4] === 0x66 && // f
    buffer[5] === 0x74 && // t
    buffer[6] === 0x79 && // y
    buffer[7] === 0x70 // p
  ) {
    return true;
  }

  return false;
}

/**
 * Validates Base64 Data URI or raw Base64 string for genuine image magic bytes
 */
export function validateBase64Image(dataUriOrBase64: string): { valid: boolean; error?: string; buffer?: Buffer } {
  if (!dataUriOrBase64 || typeof dataUriOrBase64 !== 'string') {
    return { valid: false, error: 'بيانات الصورة مفقودة أو غير صالحة' };
  }

  let base64Data = dataUriOrBase64;
  if (dataUriOrBase64.startsWith('data:')) {
    const dataUriHeader = dataUriOrBase64.slice(0, dataUriOrBase64.indexOf(','));
    if (!/^data:image\/(jpeg|png|webp|gif|avif|heic);base64$/i.test(dataUriHeader)) {
      return { valid: false, error: 'نوع بيانات الصورة غير مدعوم' };
    }
  }

  if (dataUriOrBase64.includes(',')) {
    const parts = dataUriOrBase64.split(',');
    base64Data = parts[1] || '';
  }

  try {
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length < 12) {
      return { valid: false, error: 'حجم ملف الصورة صغير جداً وغير صالح' };
    }

    const isValid = validateImageMagicBytes(buffer);
    if (!isValid) {
      return { valid: false, error: 'الملف المرفوع ليس صورة حقيقية مدعومة (JPEG, PNG, WebP, GIF, AVIF)' };
    }

    return { valid: true, buffer };
  } catch {
    return { valid: false, error: 'فشل فك ترميز بيانات الصورة' };
  }
}

/**
 * Validates remote image URLs to block SSRF, XSS (SVG scripts), and malicious executable links
 */
export function validateImageUrl(urlStr: string): { valid: boolean; error?: string } {
  if (!urlStr || typeof urlStr !== 'string') {
    return { valid: false, error: 'رابط الصورة غير صالح' };
  }

  if (urlStr.length > 2048) {
    return { valid: false, error: 'رابط الصورة طويل جداً' };
  }

  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'بروتوكول الرابط غير آمن' };
    }

    const pathname = parsed.pathname.toLowerCase();

    // 1. Block dangerous / executable extensions (including SVG which may contain embedded scripts)
    const dangerousExtensions = ['.php', '.js', '.mjs', '.ts', '.html', '.htm', '.sh', '.py', '.rb', '.exe', '.bat', '.cmd', '.svg', '.xml'];
    for (const ext of dangerousExtensions) {
      if (pathname.endsWith(ext) || pathname.includes(`${ext}?`) || pathname.includes(`${ext}/`)) {
        return { valid: false, error: `نوع الملف غير مسموح به لأسباب أمنية (${ext})` };
      }
    }

    // Remote media is rendered in guests' browsers.  Do not permit arbitrary
    // hosts; a filename extension is not proof that the resource is an image.
    const trustedDomains = ['supabase.co', 'unsplash.com', 'cloudinary.com'];
    const isTrustedHost = trustedDomains.some(
      (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );

    if (!isTrustedHost) {
      return { valid: false, error: 'يجب أن يكون رابط الصورة من مزود تخزين معتمد وآمن' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'صيغة رابط الصورة غير صحيحة' };
  }
}

/**
 * Comprehensive Image Payload Validator (Supports both Data URIs and Remote URLs)
 */
export function validateImagePayload(mediaUrl: string): { valid: boolean; error?: string } {
  if (!mediaUrl || typeof mediaUrl !== 'string') {
    return { valid: false, error: 'يرجى تقديم ملف أو رابط الصورة' };
  }

  if (mediaUrl.startsWith('data:') || !mediaUrl.startsWith('http')) {
    return validateBase64Image(mediaUrl);
  }

  return validateImageUrl(mediaUrl);
}
