/**
 * @fileoverview Touch gesture handlers for pinch-to-zoom and swipe.
 */

/**
 * Initializes pinch-to-zoom functionality on an element.
 * @param {HTMLElement} element - The element to enable zoom on.
 */
export function initPinchZoom(element) {
  let initialDistance = null;
  let currentZoom = 1.0;
  const minZoom = 0.5;
  const maxZoom = 3.0;

  element.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      initialDistance = getDistance(e.touches[0], e.touches[1]);
    }
  }, { passive: true });

  element.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && initialDistance) {
      e.preventDefault(); // Prevent default browser zoom/scroll
      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const scale = currentDistance / initialDistance;
      let newZoom = currentZoom * scale;
      
      // Clamp zoom
      newZoom = Math.max(minZoom, Math.min(newZoom, maxZoom));
      
      element.style.transform = `scale(${newZoom})`;
      element.style.transformOrigin = 'center center';
    }
  }, { passive: false });

  element.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) {
      // Re-calculate the actual applied zoom after pinch ends
      const transform = element.style.transform;
      if (transform) {
        const match = transform.match(/scale\(([^)]+)\)/);
        if (match) {
          currentZoom = parseFloat(match[1]);
          // Snap back to 1.0 if close to it
          if (currentZoom >= 0.9 && currentZoom <= 1.1) {
            currentZoom = 1.0;
            element.style.transform = 'scale(1.0)';
          }
        }
      }
      initialDistance = null;
    }
  }, { passive: true });
}

/**
 * Initializes swipe detection on an element.
 * @param {HTMLElement} element - The element to attach the swipe listener to.
 * @param {Function} onSwipeLeft - Callback for left swipe (e.g., next page).
 * @param {Function} onSwipeRight - Callback for right swipe (e.g., prev page).
 */
export function initSwipeNavigation(element, onSwipeLeft, onSwipeRight) {
  let startX = 0;
  let startY = 0;
  const threshold = 50; // Minimum distance in pixels to be considered a swipe

  element.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }
  }, { passive: true });

  element.addEventListener('touchend', (e) => {
    if (e.changedTouches.length === 1) {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      
      const diffX = endX - startX;
      const diffY = endY - startY;
      
      // Check if horizontal distance is greater than vertical distance
      if (Math.abs(diffX) > Math.abs(diffY)) {
        if (Math.abs(diffX) > threshold) {
          if (diffX > 0) {
            // Swipe right
            if (typeof onSwipeRight === 'function') onSwipeRight();
          } else {
            // Swipe left
            if (typeof onSwipeLeft === 'function') onSwipeLeft();
          }
        }
      }
    }
  }, { passive: true });
}

/**
 * Calculates distance between two touch points.
 * @param {Touch} touch1 
 * @param {Touch} touch2 
 * @returns {number} distance in pixels
 */
function getDistance(touch1, touch2) {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}
