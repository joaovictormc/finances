import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@finances/db", () => ({ db: {}, Prisma: {} }));

import { DEFAULT_HOME_SECTIONS } from "@finances/validations";
import { createPreviewToken, hasUnpublishedChanges, parseSections, pathForSlug, readPreviewToken } from "./landing";

beforeEach(() => {
  process.env.LANDING_PREVIEW_SECRET = "segredo-de-teste";
});

describe("preview token", () => {
  const now = Date.UTC(2026, 9, 15, 12, 0, 0);

  it("round-trips the page id while valid", () => {
    const token = createPreviewToken("page-1", now);
    expect(readPreviewToken(token, now + 60_000)).toBe("page-1");
  });

  it("expires after 30 minutes", () => {
    const token = createPreviewToken("page-1", now);
    expect(readPreviewToken(token, now + 31 * 60_000)).toBeNull();
  });

  it("rejects a token whose payload was swapped for another page", () => {
    const [, signature] = createPreviewToken("page-1", now).split(".");
    const forged = Buffer.from(JSON.stringify({ p: "page-2", e: now + 60_000 })).toString("base64url");
    expect(readPreviewToken(`${forged}.${signature}`, now)).toBeNull();
  });

  it("rejects a token signed with another secret", () => {
    const token = createPreviewToken("page-1", now);
    process.env.LANDING_PREVIEW_SECRET = "outro-segredo";
    expect(readPreviewToken(token, now)).toBeNull();
  });

  it("rejects garbage", () => {
    expect(readPreviewToken("abc", now)).toBeNull();
    expect(readPreviewToken("abc.def", now)).toBeNull();
  });
});

describe("hasUnpublishedChanges", () => {
  const sections = DEFAULT_HOME_SECTIONS;

  it("is true for a page never published", () => {
    expect(hasUnpublishedChanges({ draftSections: sections, publishedSections: null, publishedAt: null })).toBe(true);
  });

  it("is false when draft equals published", () => {
    expect(
      hasUnpublishedChanges({ draftSections: sections, publishedSections: structuredClone(sections), publishedAt: new Date() })
    ).toBe(false);
  });

  it("is true after the draft changes", () => {
    const draft = structuredClone(sections);
    draft[0]!.hidden = true;
    expect(hasUnpublishedChanges({ draftSections: draft, publishedSections: sections, publishedAt: new Date() })).toBe(true);
  });
});

describe("parseSections", () => {
  it("serves valid content as is", () => {
    expect(parseSections(DEFAULT_HOME_SECTIONS)).toHaveLength(DEFAULT_HOME_SECTIONS.length);
  });

  it("refuses content that does not match the schema instead of rendering it", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(parseSections([{ id: "x", type: "cta", hidden: false, data: { primaryHref: "javascript:alert(1)" } }])).toEqual([]);
  });
});

describe("pathForSlug", () => {
  it("maps the home slug to the root", () => {
    expect(pathForSlug("inicio")).toBe("/");
    expect(pathForSlug("termos")).toBe("/termos");
  });
});
