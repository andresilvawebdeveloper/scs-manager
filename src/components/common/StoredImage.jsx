import React, { useEffect, useState } from 'react';
import { getPhotoUrl, parseStorageUrl } from '../../services/privatePhotos';

// <img> para fotografias guardadas nas pastas privadas do Supabase
export default function StoredImage({ src, alt = '', fallback = null, ...rest }) {
  const isPrivate = !!parseStorageUrl(src);
  const [url, setUrl] = useState(isPrivate ? null : src);

  useEffect(() => {
    let alive = true;
    if (!isPrivate) { setUrl(src); return undefined; }
    setUrl(null);
    getPhotoUrl(src).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [src]);

  if (!url) return fallback;
  return <img src={url} alt={alt} {...rest} />;
}
