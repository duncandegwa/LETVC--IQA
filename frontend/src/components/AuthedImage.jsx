import { useEffect, useState } from 'react';
import { fetchBlob } from '../api/client';

export default function AuthedImage({ path, alt, className, fallback = null }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl;
    let cancelled = false;
    setFailed(false);
    setSrc(null);
    if (!path) return;

    fetchBlob(path)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => { if (!cancelled) setFailed(true); });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  if (!path || failed) return fallback;
  if (!src) return fallback;
  return <img src={src} alt={alt} className={className} />;
}
