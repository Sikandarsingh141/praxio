/**
 * Retrieves the genuine customer-uploaded item photo from a repair request.
 * Returns null if no photo was uploaded by the customer.
 */
export function getCustomerUploadedPhoto(request: {
  photos?: Array<{ data?: string; mimeType?: string }>;
}): string | null {
  if (!request.photos || !request.photos.length) {
    return null;
  }
  const first = request.photos[0];
  if (!first || !first.data) {
    return null;
  }
  const data = first.data.trim();
  if (!data) {
    return null;
  }
  if (
    data.startsWith('data:') ||
    data.startsWith('http://') ||
    data.startsWith('https://') ||
    data.startsWith('/') ||
    data.startsWith('blob:')
  ) {
    return data;
  }
  return `data:${first.mimeType || 'image/jpeg'};base64,${data}`;
}

export function profileImageSource(value?: string | null): string | null {
  if (!value) return null;
  const source = value.trim();
  if (!source) return null;
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(source)) return source;
  if (/^https?:\/\//i.test(source) || source.startsWith('/') || source.startsWith('blob:')) {
    return source;
  }
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(source)) {
    return `data:image/jpeg;base64,${source}`;
  }
  return null;
}
