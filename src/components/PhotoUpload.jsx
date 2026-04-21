import { useState, useRef } from 'react';
import { processImage } from '../utils/imageProcessor.js';
import styles from './PhotoUpload.module.css';

export default function PhotoUpload({ onProcessed }) {
  const [progress, setProgress] = useState(null); // null = idle
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  async function handleFiles(files) {
    if (!files?.length) return;

    setError(null);

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        setError(`"${file.name}" is not an image file.`);
        continue;
      }

      setProgress(0);

      try {
        const result = await processImage(file, (pct) => setProgress(pct));
        onProcessed(result);
      } catch (err) {
        setError(`Failed to process "${file.name}": ${err.message}`);
      } finally {
        setProgress(null);
      }
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  function handleDragOver(e) {
    e.preventDefault();
  }

  const isProcessing = progress !== null;

  return (
    <div className={styles.wrapper}>
      <div
        className={`${styles.dropzone} ${isProcessing ? styles.processing : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => !isProcessing && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && !isProcessing && inputRef.current?.click()}
        aria-label="Upload photos"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className={styles.hiddenInput}
          onChange={(e) => handleFiles(e.target.files)}
        />

        {isProcessing ? (
          <div className={styles.progressArea}>
            <p className={styles.processingLabel}>Processing…</p>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className={styles.progressPct}>{progress}%</p>
          </div>
        ) : (
          <div className={styles.prompt}>
            <svg
              className={styles.uploadIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
              />
            </svg>
            <p className={styles.promptText}>Drop photos here or click to browse</p>
            <p className={styles.promptSub}>JPEG, PNG, WebP, AVIF, GIF</p>
          </div>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
