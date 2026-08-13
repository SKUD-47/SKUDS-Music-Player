---
name: Artwork rendering
description: Durable rendering rule for locally persisted song and playlist artwork.
---

Use a real image element with an object-fit rule for artwork loaded from IndexedDB Blob URLs. Keep gradients and generated artwork only as the explicit no-artwork fallback.

**Why:** The prior CSS background-image approach could leave the decorative placeholder visible when the Blob URL was late or failed to paint, which users experienced as a random color blob.

**How to apply:** Reuse the shared object-URL hook, render `<img src={url}>` inside the fixed square container, and use `object-cover object-center` for thumbnails.