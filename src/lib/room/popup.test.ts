import { describe, it, expect } from "vitest";
import { bigRect, POPUP_W, readPopupData } from "./popup";

describe("readPopupData", () => {
  it("reads a screenshot and the placement stand-in", () => {
    const shot = { kind: "shot", from: "Bob", color: "#f00", url: "data:image/jpeg;base64,/9j/" };
    expect(readPopupData(JSON.stringify(shot))).toEqual(shot);
    expect(readPopupData('{"kind":"preview"}')).toEqual({ kind: "preview" });
  });

  it("refuses anything else, including a picture that is not an inline JPEG", () => {
    expect(readPopupData("")).toBeNull();
    expect(readPopupData("null")).toBeNull();
    expect(readPopupData('{"kind":"shot","from":"Bob","color":"#f00","url":"https://example.com/x.jpg"}')).toBeNull();
    expect(readPopupData('{"kind":"shot","from":1,"color":"#f00","url":"data:image/jpeg;base64,"}')).toBeNull();
  });
});

describe("bigRect", () => {
  it("is 960 wide at most, 16:9 under the header, centred on the work area", () => {
    const r = bigRect({ x: 1920, y: 0, width: 1920, height: 1040 });
    expect(r.width).toBe(960);
    expect(r.height).toBe(540 + 30);
    expect(r.x + r.width / 2).toBe(1920 + 960);
    expect(r.y + r.height / 2).toBe(520);
  });

  it("fits a small screen, and never goes below the small popup's width", () => {
    const r = bigRect({ x: 0, y: 0, width: 800, height: 400 });
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.y + r.height).toBeLessThanOrEqual(400);
    expect(bigRect({ x: 0, y: 0, width: 200, height: 100 }).width).toBe(POPUP_W);
  });
});
