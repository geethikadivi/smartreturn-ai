import { supabase } from './supabaseClient';

/**
 * Upload an invoice file directly to the Supabase Storage 'invoices' bucket.
 * Files are stored under `${userId}/${Date.now()}_${sanitizedFilename}` to enforce
 * RLS folder-isolation policy `(storage.foldername(name))[1] = auth.uid()::text`.
 */
export const uploadInvoiceFile = async (file, userId) => {
  if (!file || !userId) {
    throw new Error('A valid file and authenticated user ID are required for upload.');
  }

  // Sanitize filename to avoid weird characters in URL path
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${userId}/${Date.now()}_${sanitizedName}`;

  const { data, error } = await supabase.storage
    .from('invoices')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return {
    path: filePath,
    data,
  };
};

/**
 * Retrieves a valid viewable/downloadable URL for an invoice stored in the 'invoices' bucket.
 * Attempts to generate a signed URL (valid for 1 hour) which works securely with private RLS buckets.
 */
export const getInvoiceUrl = async (pathOrUrl) => {
  if (!pathOrUrl) return null;

  // If already an absolute HTTP/HTTPS URL
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }

  try {
    // Generate a 1-hour signed URL for private bucket access
    const { data, error } = await supabase.storage
      .from('invoices')
      .createSignedUrl(pathOrUrl, 3600);

    if (error || !data?.signedUrl) {
      // Fallback to public URL in case bucket was configured public
      const { data: pubData } = supabase.storage
        .from('invoices')
        .getPublicUrl(pathOrUrl);
      return pubData?.publicUrl || null;
    }

    return data.signedUrl;
  } catch (err) {
    console.warn('Failed to retrieve signed URL for invoice:', err);
    return null;
  }
};

/**
 * Removes an invoice file from the Supabase Storage 'invoices' bucket.
 */
export const deleteInvoiceFile = async (filePath) => {
  if (!filePath || filePath.startsWith('http')) return;
  try {
    await supabase.storage.from('invoices').remove([filePath]);
  } catch (err) {
    console.warn('Failed to delete invoice from storage:', err);
  }
};
