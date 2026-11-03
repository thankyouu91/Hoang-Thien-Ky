// Nạp engine (three + cảnh) bằng import() động, một lần; và hàng đợi nướng ảnh, mỗi ảnh một lượt,
// nhường luồng giữa hai ảnh để cuộn danh sách hay khung trận không giật.
type Engine = typeof import("./engine/entry.ts");
let engine: Promise<Engine> | undefined;

export function load(): Promise<Engine> {
  return (engine ??= import("./engine/entry.ts"));
}

/** Engine đã nạp chưa (không kích nạp). */
export function loaded(): Promise<Engine> | undefined {
  return engine;
}

let queue: Promise<unknown> = Promise.resolve();

export function enqueue<T>(job: () => T): Promise<T> {
  const p = queue.then(
    () =>
      new Promise<T>((resolve, reject) =>
        setTimeout(() => {
          try {
            resolve(job());
          } catch (e) {
            reject(e);
          }
        }, 0),
      ),
  );
  queue = p.catch(() => undefined);
  return p;
}
