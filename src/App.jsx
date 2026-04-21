import { useState } from 'react';
import PhotoUpload from './components/PhotoUpload.jsx';
import Gallery from './components/Gallery.jsx';
import styles from './App.module.css';

export default function App() {
  const [photos, setPhotos] = useState([]);

  function handleProcessed(photo) {
    setPhotos((prev) => [photo, ...prev]);
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.logo}>Pixelmelt</h1>
        <p className={styles.tagline}>Drop your photos. We&apos;ll do the rest.</p>
      </header>

      <main className={styles.main}>
        <section className={styles.uploadSection}>
          <PhotoUpload onProcessed={handleProcessed} />
        </section>

        <Gallery photos={photos} />
      </main>
    </div>
  );
}
