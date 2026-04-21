import styles from './PhotoCard.module.css';

export default function PhotoCard({ photo }) {
  const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

  return (
    <div className={styles.card}>
      <div className={styles.imageWrapper}>
        <img
          src={photo.url}
          alt={photo.name}
          className={styles.image}
          loading="eager"
          decoding="async"
        />
      </div>
      <div className={styles.meta}>
        <div className={styles.nameRow}>
          <p className={styles.name} title={photo.name}>{photo.name}</p>
          {photo.caricature && (
            <span className={styles.badge} title="Caricature applied">🎭</span>
          )}
        </div>
        <div className={styles.stats}>
          <span>{photo.width} × {photo.height}</span>
          <span className={styles.dot}>·</span>
          <span>{kb(photo.processedSize)}</span>
        </div>
      </div>
    </div>
  );
}
