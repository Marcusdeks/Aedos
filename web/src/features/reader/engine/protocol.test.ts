import { describe, expect, it, vi } from "vitest";
import { createQueue, type WorkerResponse } from "./protocol";

const blob = new Blob(["audio"]);

describe("createQueue", () => {
  it("ejecuta las tareas de una en una y en orden", async () => {
    const order: string[] = [];
    let finishFirst!: () => void;
    const enqueue = createQueue(() => {});

    enqueue(1, async () => {
      order.push("empieza 1");
      await new Promise<void>((resolve) => (finishFirst = resolve));
      order.push("acaba 1");
      return blob;
    });
    enqueue(2, async () => {
      order.push("empieza 2");
      return blob;
    });

    await vi.waitFor(() => expect(order).toEqual(["empieza 1"])); // la 2 espera su turno
    finishFirst();
    await vi.waitFor(() => expect(order).toEqual(["empieza 1", "acaba 1", "empieza 2"]));
  });

  it("responde con el audio o con el error, y un error no bloquea la cola", async () => {
    const replies: WorkerResponse[] = [];
    const enqueue = createQueue((msg) => replies.push(msg));

    enqueue(1, () => Promise.reject(new Error("modelo roto")));
    enqueue(2, () => Promise.resolve(blob));

    await vi.waitFor(() => expect(replies).toHaveLength(2));
    expect(replies[0]).toEqual({ id: 1, type: "error", message: "modelo roto" });
    expect(replies[1]).toEqual({ id: 2, type: "done", audio: blob });
  });
});
