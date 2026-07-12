import { describe, it, expect } from 'vitest';
import { det, circleFromThreePoints, fixed } from '../src/fsm/math';

describe('math helpers', () => {
  describe('det', () => {
    it('calculates the determinant of a 3x3 matrix', () => {
      // Identity matrix determinant should be 1
      expect(det(
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
      )).toBe(1);

      // Simple matrix
      expect(det(
        1, 2, 3,
        4, 5, 6,
        7, 8, 9
      )).toBe(0);

      // Random matrix
      expect(det(
        3, 2, 4,
        2, -3, -1,
        1, 2, 3
      )).toBe(-5);
    });
  });

  describe('circleFromThreePoints', () => {
    it('calculates center and radius of a circle from 3 points', () => {
      // Points on unit circle: (0, 1), (1, 0), (0, -1)
      const circle = circleFromThreePoints(0, 1, 1, 0, 0, -1);
      expect(circle.x).toBeCloseTo(0);
      expect(circle.y).toBeCloseTo(0);
      expect(circle.radius).toBeCloseTo(1);
    });

    it('calculates center and radius for another set of points', () => {
      // Circle centered at (1, 2) with radius 5. Points: (1, 7), (6, 2), (-3, -1)
      // Check distance: (1-1)^2+(7-2)^2 = 25, (6-1)^2+(2-2)^2 = 25, (-3-1)^2+(-1-2)^2 = 16+9=25.
      const circle = circleFromThreePoints(1, 7, 6, 2, -3, -1);
      expect(circle.x).toBeCloseTo(1);
      expect(circle.y).toBeCloseTo(2);
      expect(circle.radius).toBeCloseTo(5);
    });
  });

  describe('fixed', () => {
    it('formats numbers to specified digits and trims trailing zeros and dots', () => {
      expect(fixed(2.5, 2)).toBe('2.5');
      expect(fixed(2.0, 3)).toBe('2');
      expect(fixed(1.234, 2)).toBe('1.23');
      expect(fixed(1.236, 2)).toBe('1.24');
      expect(fixed(0.0001, 2)).toBe('0');
      expect(fixed(100, 4)).toBe('100');
    });
  });
});
