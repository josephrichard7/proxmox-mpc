/**
 * Lazy Loading Image Component
 * 
 * Optimizes image loading with intersection observer and placeholder support.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Box, Skeleton } from '@mantine/core';

interface LazyImageProps {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  placeholder?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onLoad?: () => void;
  onError?: () => void;
  rootMargin?: string;
  threshold?: number;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  width,
  height,
  placeholder,
  className,
  style,
  onLoad,
  onError,
  rootMargin = '50px',
  threshold = 0.1
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin,
        threshold
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [rootMargin, threshold]);

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  };

  const defaultPlaceholder = (
    <Skeleton 
      width={width} 
      height={height} 
      style={style}
      className={className}
    />
  );

  const errorPlaceholder = (
    <Box
      style={{
        width,
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8f9fa',
        color: '#6c757d',
        border: '1px solid #dee2e6',
        borderRadius: '4px',
        ...style
      }}
      className={className}
    >
      Failed to load image
    </Box>
  );

  if (hasError) {
    return errorPlaceholder;
  }

  if (!isVisible || isLoading) {
    return placeholder || defaultPlaceholder;
  }

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={style}
      onLoad={handleLoad}
      onError={handleError}
      loading="lazy"
    />
  );
};

// Progressive image loading with blur effect
interface ProgressiveImageProps extends Omit<LazyImageProps, 'placeholder'> {
  placeholderSrc?: string;
  blurAmount?: number;
}

export const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  src,
  placeholderSrc,
  blurAmount = 10,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);

  const handleLoad = () => {
    setIsLoaded(true);
    props.onLoad?.();
  };

  return (
    <Box style={{ position: 'relative', ...props.style }}>
      {placeholderSrc && (
        <img
          src={placeholderSrc}
          alt={props.alt}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            filter: `blur(${blurAmount}px)`,
            transition: 'opacity 0.3s ease',
            opacity: isLoaded ? 0 : 1,
            zIndex: 1
          }}
        />
      )}
      
      <LazyImage
        {...props}
        src={src}
        onLoad={handleLoad}
        style={{
          position: 'relative',
          zIndex: 2,
          transition: 'opacity 0.3s ease',
          opacity: isLoaded ? 1 : 0,
          ...props.style
        }}
      />
    </Box>
  );
};