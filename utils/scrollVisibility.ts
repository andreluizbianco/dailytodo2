interface ScrollRevealParams {
  contentHeight: number;
  currentScrollY: number;
  margin?: number;
  rangeHeight: number;
  rangeY: number;
  viewportHeight: number;
}

export const getScrollYToRevealRange = ({
  contentHeight,
  currentScrollY,
  margin = 0,
  rangeHeight,
  rangeY,
  viewportHeight,
}: ScrollRevealParams): number => {
  const maxScrollY = Math.max(0, contentHeight - viewportHeight);
  const visibleTop = currentScrollY + margin;
  const visibleBottom = currentScrollY + viewportHeight - margin;
  const rangeBottom = rangeY + rangeHeight;
  let nextScrollY = currentScrollY;

  if (rangeHeight + margin * 2 > viewportHeight || rangeY < visibleTop) {
    nextScrollY = rangeY - margin;
  } else if (rangeBottom > visibleBottom) {
    nextScrollY = rangeBottom - viewportHeight + margin;
  }

  return Math.max(0, Math.min(maxScrollY, Math.round(nextScrollY)));
};
