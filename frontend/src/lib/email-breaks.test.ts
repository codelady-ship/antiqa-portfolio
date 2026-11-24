import { describe, expect, it } from "vitest";
import { emailBreaks } from "./email-breaks";

describe("emailBreaks", () => {
  it("breaks after @ and before each dot", () => {
    expect(emailBreaks("jalilova.antiqa@gmail.com")).toEqual(["jalilova", ".antiqa@", "gmail", ".com"]);
  });
  it("joins back to the same address", () => {
    for (const e of ["a@b.co.uk", "x@y", "plain", ".lead@x.", ""]) expect(emailBreaks(e).join("")).toBe(e);
  });
  it("never splits inside a part", () => {
    expect(emailBreaks("name@domain")).toEqual(["name@", "domain"]);
  });
});
