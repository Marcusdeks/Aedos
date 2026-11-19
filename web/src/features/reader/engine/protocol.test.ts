import { describe, expect, it, vi } from "vitest";
import { createQueue, type WorkerResponse } from "./protocol";

const blob = new Blob(["audio"]);

describe("createQueue", () => {
  it("ejecuta las tareas de una en una y en orden", async () => {
    const order: string[] = [];
    let finishFirst!: () => void;
    const { add } = createQueue(() => {});

    add(1, async () => {
      order.push("empieza 1");
      await new Promise<void>((resolve) => (finishFirst = resolve));
      order.push("acaba 1");
      return blob;
    });
    add(2, async () => {
      order.push("empieza 2");
      return blob;
    });

    await vi.waitFor(() => expect(order).toEqual(["empieza 1"])); // la 2 espera su turno
    finishFirst();
    await vi.waitFor(() => expect(order).toEqual(["empieza 1", "acaba 1", "empieza 2"]));
  });

  it("responde con el audio o con el error, y un error no bloquea la cola", async () => {
    const replies: WorkerResponse[] = [];
    const { add } = createQueue((msg) => replies.push(msg));

    add(1, () => Promise.reject(new Error("modelo roto")));
    add(2, () => Promise.resolve(blob));

    await vi.waitFor(() => expect(replies).toHaveLength(2));
    expect(replies[0]).toEqual({ id: 1, type: "error", message: "modelo roto" });
    expect(replies[1]).toEqual({ id: 2, type: "done", audio: blob });
  });

  it("se salta las peticiones canceladas que aún esperaban turno", async () => {
    const replies: WorkerResponse[] = [];
    const { add, cancel } = createQueue((msg) => replies.push(msg));
    const skipped = vi.fn(() => Promise.resolve(blob));

    add(1, () => Promise.resolve(blob));
    add(2, skipped);
    add(3, () => Promise.resolve(blob));
    cancel(2);

    await vi.waitFor(() => expect(replies.map((r) => r.id)).toEqual([1, 3]));
    expect(skipped).not.toHaveBeenCalled();
  });
});
