'use client';

import { useRef, useEffect, useCallback } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
}

interface PinchHandlers {
  onPinchIn?: (scale: number) => void;
  onPinchOut?: (scale: number) => void;
}

interface TouchGestureOptions {
  swipeThreshold?: number;
  pinchThreshold?: number;
  longPressDelay?: number;
}

export function useSwipe(
  elementRef: React.RefObject<HTMLElement>,
  handlers: SwipeHandlers,
  options: TouchGestureOptions = {}
) {
  const { swipeThreshold = 50 } = options;
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const touchEnd = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    touchEnd.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStart.current || !touchEnd.current) return;

    const deltaX = touchEnd.current.x - touchStart.current.x;
    const deltaY = touchEnd.current.y - touchStart.current.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Horizontal swipe
    if (absX > absY && absX > swipeThreshold) {
      if (deltaX > 0) {
        handlers.onSwipeRight?.();
      } else {
        handlers.onSwipeLeft?.();
      }
    }

    // Vertical swipe
    if (absY > absX && absY > swipeThreshold) {
      if (deltaY > 0) {
        handlers.onSwipeDown?.();
      } else {
        handlers.onSwipeUp?.();
      }
    }

    // Reset
    touchStart.current = null;
    touchEnd.current = null;
  }, [handlers, swipeThreshold]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, elementRef]);
}

export function usePinch(
  elementRef: React.RefObject<HTMLElement>,
  handlers: PinchHandlers,
  options: TouchGestureOptions = {}
) {
  const { pinchThreshold = 0.1 } = options;
  const initialDistance = useRef<number | null>(null);

  const getDistance = (touches: TouchList) => {
    const touch1 = touches[0];
    const touch2 = touches[1];
    return Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );
  };

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      initialDistance.current = getDistance(e.touches);
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2 && initialDistance.current) {
      const currentDistance = getDistance(e.touches);
      const scale = currentDistance / initialDistance.current;

      if (scale > 1 + pinchThreshold) {
        handlers.onPinchOut?.(scale);
      } else if (scale < 1 - pinchThreshold) {
        handlers.onPinchIn?.(scale);
      }
    }
  }, [handlers, pinchThreshold]);

  const handleTouchEnd = useCallback(() => {
    initialDistance.current = null;
  }, []);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, elementRef]);
}

export function useLongPress(
  elementRef: React.RefObject<HTMLElement>,
  onLongPress: () => void,
  options: TouchGestureOptions = {}
) {
  const { longPressDelay = 500 } = options;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  const handleTouchStart = useCallback(() => {
    isLongPressRef.current = false;
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onLongPress();

      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }, longPressDelay);
  }, [onLongPress, longPressDelay]);

  const handleTouchEnd = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    // Cancel long press if user moves finger
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd);
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchcancel', handleTouchEnd);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [handleTouchStart, handleTouchEnd, handleTouchMove, elementRef]);
}

// Combined touch gestures hook
export function useTouchGestures(
  elementRef: React.RefObject<HTMLElement>,
  handlers: SwipeHandlers & PinchHandlers & { onLongPress?: () => void },
  options: TouchGestureOptions = {}
) {
  useSwipe(elementRef, handlers, options);
  usePinch(elementRef, handlers, options);

  if (handlers.onLongPress) {
    useLongPress(elementRef, handlers.onLongPress, options);
  }
}

// Pull to refresh hook
export function usePullToRefresh(
  onRefresh: () => Promise<void>,
  options: { threshold?: number } = {}
) {
  const { threshold = 100 } = options;
  const startY = useRef(0);
  const currentY = useRef(0);
  const pulling = useRef(false);
  const refreshing = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY === 0 && !refreshing.current) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling.current) return;

    currentY.current = e.touches[0].clientY;
    const pullDistance = currentY.current - startY.current;

    if (pullDistance > 0) {
      e.preventDefault();
      // Visual feedback
      document.body.style.transform = `translateY(${Math.min(pullDistance * 0.5, threshold)}px)`;
    }
  }, [threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;

    const pullDistance = currentY.current - startY.current;
    pulling.current = false;

    if (pullDistance > threshold && !refreshing.current) {
      refreshing.current = true;

      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate([50, 30, 50]);
      }

      // Animate to loading state
      document.body.style.transition = 'transform 0.3s';
      document.body.style.transform = `translateY(60px)`;

      try {
        await onRefresh();
      } finally {
        refreshing.current = false;
        document.body.style.transform = 'translateY(0)';
        setTimeout(() => {
          document.body.style.transition = '';
        }, 300);
      }
    } else {
      // Animate back
      document.body.style.transition = 'transform 0.3s';
      document.body.style.transform = 'translateY(0)';
      setTimeout(() => {
        document.body.style.transition = '';
      }, 300);
    }
  }, [onRefresh, threshold]);

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);
}