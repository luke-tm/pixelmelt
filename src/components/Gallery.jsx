import { useState } from 'react';
import PhotoCard from './PhotoCard.jsx';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll.js';
import styles from './Gallery.module.css';

const PAGE_SIZE = 12;

export default function Gallery({ photos }) {
  const [page, setPage] = useState(1);

  const visiblePhotos = photos.slice(0, page * PAGE_SIZE);
  const hasMore = visiblePhotos.length < photos.length;

  useInfiniteScroll(() => {
    if (hasMore) setPage((p) => p + 1);
  }, hasMore);

  if (photos.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No photos yet. Upload some above!</p>
      </div>
    );
  }

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <h2 className={styles.title}>Gallery</h2>
        <span className={styles.count}>{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
      </header>

      <div className={styles.grid}>
        {visiblePhotos.map((photo) => (
          <PhotoCard key={photo.id} photo={photo} />
        ))}
      </div>

      {hasMore && (
        <div className={styles.loadMoreHint}>
          <p>Scroll down to load more</p>
        </div>
      )}
    </section>
  );
}
