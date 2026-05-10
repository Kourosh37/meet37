import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import type { Point, Stroke } from '../types';

interface WhiteboardCanvasProps {
  strokes: Stroke[];
  disabled: boolean;
  onCreateStroke: (stroke: Stroke) => void;
}

const STROKE_COLOR = '#f97316';

export function WhiteboardCanvas({
  strokes,
  disabled,
  onCreateStroke,
}: WhiteboardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<Point[] | null>(null);

  const redraw = useCallback(
    (draftPoints: Point[] | null) => {
      const canvas = canvasRef.current;
      const wrapper = wrapperRef.current;
      if (!canvas || !wrapper) {
        return;
      }

      const pixelRatio = window.devicePixelRatio || 1;
      const width = wrapper.clientWidth;
      const height = wrapper.clientHeight;

      if (canvas.width !== width * pixelRatio || canvas.height !== height * pixelRatio) {
        canvas.width = width * pixelRatio;
        canvas.height = height * pixelRatio;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }

      const context = canvas.getContext('2d');
      if (!context) {
        return;
      }

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.lineWidth = 3;

      const renderStroke = (points: Point[], color: string) => {
        if (points.length < 2) {
          return;
        }

        context.beginPath();
        context.strokeStyle = color;
        context.moveTo(points[0].x, points[0].y);
        for (let index = 1; index < points.length; index += 1) {
          context.lineTo(points[index].x, points[index].y);
        }
        context.stroke();
      };

      for (const stroke of strokes) {
        renderStroke(stroke.points, stroke.color);
      }

      if (draftPoints) {
        renderStroke(draftPoints, STROKE_COLOR);
      }
    },
    [strokes],
  );

  useEffect(() => {
    redraw(draft);
  }, [draft, redraw]);

  useEffect(() => {
    const onResize = () => redraw(draft);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draft, redraw]);

  const pointFromEvent = (event: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { x: 0, y: 0 };
    }

    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (disabled) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    setDraft([point]);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (disabled || !draft) {
      return;
    }

    const point = pointFromEvent(event);
    setDraft((current) => (current ? [...current, point] : [point]));
  };

  const completeDraft = () => {
    if (!draft || draft.length < 2) {
      setDraft(null);
      return;
    }

    onCreateStroke({
      id: crypto.randomUUID(),
      color: STROKE_COLOR,
      points: draft,
    });
    setDraft(null);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (disabled) {
      return;
    }

    event.currentTarget.releasePointerCapture(event.pointerId);
    completeDraft();
  };

  return (
    <div className="whiteboard-wrapper" ref={wrapperRef}>
      <canvas
        ref={canvasRef}
        className="whiteboard-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
    </div>
  );
}

