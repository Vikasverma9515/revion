'use client';
// Subscribes to one of the /api/sim/* Server-Sent Event streams.
import { useCallback, useEffect, useRef, useState } from 'react';

export type StreamStatus = 'idle' | 'running' | 'done' | 'stopped' | 'error';

export function useStream(onEvent: (event: string, data: any) => void) {
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const source = useRef<EventSource | null>(null);
  const handler = useRef(onEvent);
  handler.current = onEvent;

  const stop = useCallback(() => {
    source.current?.close();
    source.current = null;
  }, []);

  const start = useCallback(
    (url: string) => {
      stop();
      setStatus('running');
      setMessage(null);
      let finished = false;
      let stopped = false;
      const es = new EventSource(url);
      source.current = es;
      const forward = (name: string) =>
        es.addEventListener(name, (e) => handler.current(name, JSON.parse((e as MessageEvent).data)));
      ['start', 'progress', 'result', 'row', 'check'].forEach(forward);
      es.addEventListener('stopped', (e) => {
        stopped = true;
        setMessage(JSON.parse((e as MessageEvent).data).message);
      });
      es.addEventListener('error', (e) => {
        // Server-sent "error" events carry data; network errors do not.
        const data = (e as MessageEvent).data;
        if (data) {
          finished = true;
          setStatus('error');
          setMessage(JSON.parse(data).message);
          es.close();
        } else if (!finished) {
          finished = true;
          setStatus('error');
          setMessage('The connection to the simulation was lost. Try again.');
          es.close();
        }
      });
      es.addEventListener('done', () => {
        if (!finished) setStatus(stopped ? 'stopped' : 'done');
        finished = true;
        es.close();
      });
    },
    [stop],
  );

  const cancel = useCallback(() => {
    stop();
    setStatus('stopped');
    setMessage('Cancelled.');
  }, [stop]);

  useEffect(() => stop, [stop]);
  return { status, message, start, cancel };
}
